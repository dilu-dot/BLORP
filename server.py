"""Blorp V5.1 local development server — Python standard library only.

This is a localhost foundation, NOT a production authentication or payment service.
Use: py -3 server.py (Windows) or python3 server.py.
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
import hashlib
import base64
import binascii
import hmac
import json
import mimetypes
import os
import re
import secrets
import sqlite3
import sys
import threading
import time
import uuid
from urllib.parse import urlparse

import local_runtime
import payment_checkout

BASE = Path(__file__).resolve().parent
PUBLIC = BASE / 'public'
DATA_DIR = Path(os.environ.get('BLORP_DATA_DIR', str(BASE / 'data'))).resolve()
DB = DATA_DIR / 'blorp.sqlite3'
HOST = '127.0.0.1'
PORT = int(os.environ.get('BLORP_PORT', '8765'))
COOKIE = 'blorp_session'
SESSION_AGE = 7 * 24 * 3600
MAX_JSON = 16 * 1024
FREE_CREDITS = 4_000_000
PLAN_PRICES = {('builder', 'monthly'): 2000, ('builder', 'annual'): 21600,
               ('studio', 'monthly'): 5000, ('studio', 'annual'): 54000}
GOOGLE_CLIENT_ID = os.environ.get('BLORP_GOOGLE_CLIENT_ID', '').strip()
GOOGLE_DESKTOP_CLIENT_ID = os.environ.get('BLORP_GOOGLE_DESKTOP_CLIENT_ID', '').strip()
PAYMENT_INSTRUCTIONS = os.environ.get('BLORP_PAYMENT_INSTRUCTIONS', '').strip()[:700]
MAX_QR_BYTES = 350_000
ITERATIONS = 310_000
_attempts: dict[str, list[float]] = {}
_attempt_lock = threading.Lock()
_model_lock = threading.BoundedSemaphore(value=1)


def database():
    db = sqlite3.connect(DB, timeout=8)
    db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON')
    return db


def init_db():
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with database() as conn:
        conn.executescript('''
        CREATE TABLE IF NOT EXISTS users (
           id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
           salt TEXT NOT NULL, password_hash TEXT NOT NULL,
           credits_remaining INTEGER NOT NULL DEFAULT 4000000 CHECK(credits_remaining >= 0),
           plan TEXT NOT NULL DEFAULT 'free' CHECK(plan IN ('free','builder','studio')),
           created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS sessions (
           token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           expires_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS projects (
           id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           title TEXT NOT NULL, payload TEXT NOT NULL, updated_at INTEGER NOT NULL,
           PRIMARY KEY(id,user_id));
        CREATE TABLE IF NOT EXISTS payment_requests (
           id TEXT PRIMARY KEY,
           user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           plan TEXT NOT NULL CHECK(plan IN ('builder','studio')),
           interval TEXT NOT NULL CHECK(interval IN ('monthly','annual')),
           amount_cents INTEGER NOT NULL,
           currency TEXT NOT NULL DEFAULT 'USD',
           method TEXT NOT NULL CHECK(method IN ('manual','hosted_link')),
           status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
           reference TEXT NOT NULL DEFAULT '',
           owner_note TEXT NOT NULL DEFAULT '',
           reviewed_by TEXT,
           created_at INTEGER NOT NULL,
           reviewed_at INTEGER);
        CREATE TABLE IF NOT EXISTS payment_settings (
           id INTEGER PRIMARY KEY CHECK(id=1),
           upi_id TEXT NOT NULL DEFAULT '',
           prices_inr_json TEXT NOT NULL DEFAULT '{}',
           qr_image BLOB,
           qr_mime TEXT,
           updated_by TEXT,
           updated_at INTEGER);
        INSERT OR IGNORE INTO payment_settings(id) VALUES (1);
        CREATE TABLE IF NOT EXISTS membership_audit (
           id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, user_id TEXT NOT NULL,
           old_plan TEXT NOT NULL, new_plan TEXT NOT NULL, expires_at INTEGER,
           reason TEXT NOT NULL, created_at INTEGER NOT NULL);
        CREATE TABLE IF NOT EXISTS local_artifacts (
           id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           model TEXT NOT NULL, created_at INTEGER NOT NULL);
        ''')
        columns={r['name'] for r in conn.execute('PRAGMA table_info(users)')}
        for col,definition in {
            'role': "TEXT NOT NULL DEFAULT 'member'",
            'plan_expires_at': 'INTEGER',
            'google_sub': 'TEXT',
        }.items():
            if col not in columns:
                conn.execute(f'ALTER TABLE users ADD COLUMN {col} {definition}')
        conn.execute('CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL')
        payment_columns={r['name'] for r in conn.execute('PRAGMA table_info(payment_requests)')}
        for col,definition in {'paid_inr_paise':'INTEGER','payer_name':"TEXT NOT NULL DEFAULT ''"}.items():
            if col not in payment_columns:
                conn.execute(f'ALTER TABLE payment_requests ADD COLUMN {col} {definition}')
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS payments_unique_submitted_utr ON payment_requests(UPPER(reference)) WHERE reference<>'' AND method='manual'")
        payment_checkout.init_schema(conn)


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), ITERATIONS).hex()


def effective_plan(row):
    if not row:
        return 'free'
    expires=row['plan_expires_at']
    return row['plan'] if row['plan'] != 'free' and expires and expires > int(time.time()) else 'free'


def has_build_access(row):
    return bool(row and (row['role']=='owner' or effective_plan(row) in ('builder','studio')))


def public_payment_settings(conn):
    row=conn.execute('SELECT * FROM payment_settings WHERE id=1').fetchone()
    try: prices=json.loads(row['prices_inr_json']) if row else {}
    except (TypeError, ValueError): prices={}
    return {'upi_id':row['upi_id'] if row else '', 'prices_inr_paise':prices,
            'qr_configured':bool(row and row['qr_image']),
            'updated_at':row['updated_at'] if row else None}


def validate_qr_image(source):
    if not isinstance(source,str) or len(source)>500000:
        raise ValueError('Upload a PNG or JPEG image smaller than 350 KB')
    if source.startswith('data:image/png;base64,'):
        mime='image/png'; raw=source[len('data:image/png;base64,'):]
    elif source.startswith('data:image/jpeg;base64,'):
        mime='image/jpeg'; raw=source[len('data:image/jpeg;base64,'):]
    else:
        raise ValueError('Only PNG or JPEG QR images are supported')
    try: decoded=base64.b64decode(raw,validate=True)
    except (ValueError,binascii.Error): raise ValueError('Invalid image data')
    if not (100<=len(decoded)<=MAX_QR_BYTES):
        raise ValueError('QR image must be smaller than 350 KB')
    if mime=='image/png' and not decoded.startswith(b'\x89PNG\r\n\x1a\n'):
        raise ValueError('Invalid PNG image')
    if mime=='image/jpeg' and not (decoded.startswith(b'\xff\xd8\xff') and decoded.endswith(b'\xff\xd9')):
        raise ValueError('Invalid JPEG image')
    return decoded,mime


def safe_checkout_url(plan, interval):
    url=os.environ.get(f'BLORP_CHECKOUT_URL_{plan.upper()}_{interval.upper()}','').strip()
    parsed=urlparse(url)
    return url if parsed.scheme=='https' and parsed.netloc and not parsed.username and not parsed.password else None


def verify_google_credential(credential):
    if not (GOOGLE_CLIENT_ID or GOOGLE_DESKTOP_CLIENT_ID):
        raise RuntimeError('Google login is not configured')
    if not isinstance(credential,str) or len(credential)>8000:
        raise ValueError('Invalid Google credential')
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests
    except ImportError as exc:
        raise RuntimeError('Install optional Google dependencies: pip install -r requirements-google.txt') from exc
    # Explicitly allow only our configured Web or Desktop Google OAuth clients.
    # Never accept an unverified audience from the JWT itself.
    claims=None
    for client_id in (GOOGLE_CLIENT_ID,GOOGLE_DESKTOP_CLIENT_ID):
        if not client_id:
            continue
        try:
            claims=id_token.verify_oauth2_token(credential,requests.Request(),client_id)
            break
        except ValueError:
            continue
    if claims is None:
        raise ValueError('Invalid Google credential or OAuth client audience')
    if claims.get('iss') not in ('accounts.google.com','https://accounts.google.com'):
        raise ValueError('Invalid Google issuer')
    if not claims.get('sub') or claims.get('email_verified') is not True:
        raise ValueError('Verified Google email required')
    email=str(claims.get('email','')).lower().strip()
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email):
        raise ValueError('Invalid Google email')
    return {'sub':str(claims['sub']),'email':email,'name':str(claims.get('name') or email.split('@')[0])[:55]}


def safe_user(row):
    if row is None:
        return None
    return {'id': row['id'], 'name': row['name'], 'email': row['email'],
            'plan': effective_plan(row), 'role': row['role'], 'plan_expires_at': row['plan_expires_at'],
            'build_fast_unlocked': has_build_access(row), 'credits_remaining': row['credits_remaining']}


def allow_attempt(key):
    now = time.time()
    with _attempt_lock:
        current = [t for t in _attempts.get(key, []) if now - t < 60]
        if len(current) >= 8:
            _attempts[key] = current
            return False
        current.append(now)
        _attempts[key] = current
    return True


class Handler(BaseHTTPRequestHandler):
    server_version = 'BlorpLocal/0.5.3'

    def log_message(self, fmt, *args):
        # Avoid printing credentials, cookies or JSON payloads.
        sys.stderr.write('%s [%s] %s\n' % (self.address_string(), self.log_date_time_string(), fmt % args))

    def headers_common(self):
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Frame-Options', 'DENY')

    def response(self, status, obj, cookie=None):
        body = json.dumps(obj, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.headers_common()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        try:
            length = int(self.headers.get('Content-Length', '0'))
        except ValueError:
            return None
        max_bytes = 500_000 if urlsplit(self.path).path=='/api/owner/payments/settings' else MAX_JSON
        if length < 1 or length > max_bytes:
            return None
        if self.headers.get('Content-Type', '').split(';')[0].lower() != 'application/json':
            return None
        try:
            obj = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            return None
        return obj if isinstance(obj, dict) else None

    def check_origin(self):
        origin = self.headers.get('Origin')
        # Same-origin fetch does not always send Origin on localhost in older clients.
        if origin and origin not in {f'http://127.0.0.1:{PORT}', f'http://localhost:{PORT}'}:
            self.response(403, {'error': 'Cross-origin requests not allowed'})
            return False
        return True

    def find_user(self):
        raw = self.headers.get('Cookie', '')
        if not raw or len(raw) > 3000:
            return None
        try:
            cookie = SimpleCookie(); cookie.load(raw)
            token = cookie[COOKIE].value if COOKIE in cookie else ''
        except Exception:
            return None
        if not token or len(token) > 128:
            return None
        token_hash = hashlib.sha256(token.encode()).hexdigest()
        with database() as conn:
            return conn.execute('''SELECT users.* FROM sessions
                 JOIN users ON sessions.user_id=users.id
                 WHERE sessions.token_hash=? AND sessions.expires_at>?''', (token_hash, int(time.time()))).fetchone()

    def create_session(self, user):
        token = secrets.token_urlsafe(32)
        with database() as conn:
            conn.execute('INSERT INTO sessions(token_hash,user_id,expires_at) VALUES (?,?,?)',
                         (hashlib.sha256(token.encode()).hexdigest(), user['id'], int(time.time()) + SESSION_AGE))
        return f'{COOKIE}={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age={SESSION_AGE}'

    def do_GET(self):
        path = urlsplit(self.path).path
        if path == '/api/health':
            return self.response(200, {'ok': True, 'version': 'v5.3-owner-payments', 'local_ollama_supported': True, 'billing_connected': False,
                                       'manual_requests': True, 'timed_checkout_supported': True, 'google_configured': bool(GOOGLE_CLIENT_ID or GOOGLE_DESKTOP_CLIENT_ID)})
        if path == '/api/auth/config':
            return self.response(200, {'google_client_id': GOOGLE_CLIENT_ID, 'google_desktop_client_id': GOOGLE_DESKTOP_CLIENT_ID})
        if path == '/api/billing/qr':
            user=self.find_user()
            if not user:return self.response(401,{'error':'Sign in to see payment QR'})
            with database() as conn:
                record=conn.execute('SELECT qr_image,qr_mime FROM payment_settings WHERE id=1').fetchone()
            if not record or not record['qr_image']:
                return self.response(404,{'error':'Owner has not configured a payment QR'})
            payload=record['qr_image']
            self.send_response(200);self.headers_common()
            self.send_header('Content-Type',record['qr_mime'])
            self.send_header('Content-Length',str(len(payload)))
            self.end_headers()
            return self.wfile.write(payload)
        if path == '/api/billing/plans':
            prices=[{'plan':p,'interval':i,'currency':'USD','amount_cents':c,'checkout_url':safe_checkout_url(p,i)}
                    for (p,i),c in PLAN_PRICES.items()]
            with database() as conn: payment_config=public_payment_settings(conn)
            return self.response(200, {'plans':prices,'payment_instructions':PAYMENT_INSTRUCTIONS,
                                       'upi':payment_config, 'manual_approval':True,'automatic_billing':False})
        if path == '/api/billing/attempt':
            user=self.find_user()
            if not user:return self.response(401,{'error':'Sign in required'})
            params=parse_qs(urlsplit(self.path).query)
            attempt_id=params.get('id',[])
            if len(attempt_id)!=1:return self.response(422,{'error':'Provide a checkout attempt ID'})
            try:
                with database() as conn:
                    result=payment_checkout.get_attempt(conn,user['id'],attempt_id[0])
                return self.response(200,result)
            except payment_checkout.CheckoutError as exc:
                return self.response(exc.status,{'error':str(exc)})
        if path == '/api/billing/requests':
            user=self.find_user()
            if not user:return self.response(401,{'error':'Sign in required'})
            with database() as conn:
                records=conn.execute('SELECT id,plan,interval,amount_cents,currency,method,status,reference,paid_inr_paise,payer_name,created_at,reviewed_at FROM payment_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 30',(user['id'],)).fetchall()
            return self.response(200,{'requests':[dict(r) for r in records]})
        if path == '/api/owner/overview':
            user=self.find_user()
            if not user:return self.response(401,{'error':'Sign in required'})
            if user['role']!='owner':return self.response(403,{'error':'Owner access only'})
            with database() as conn:
                members=conn.execute('SELECT id,email,name,plan,plan_expires_at,credits_remaining,role,created_at FROM users ORDER BY created_at DESC LIMIT 250').fetchall()
                pending=conn.execute('''SELECT p.id,p.plan,p.interval,p.amount_cents,p.currency,p.method,p.status,p.reference,p.owner_note,p.created_at,p.reviewed_at,u.email,u.name
                    FROM payment_requests p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT 250''').fetchall()
                audits=conn.execute('SELECT * FROM membership_audit ORDER BY created_at DESC LIMIT 60').fetchall()
                settings=public_payment_settings(conn)
                approved=conn.execute("SELECT paid_inr_paise,reviewed_at FROM payment_requests WHERE status='approved' AND paid_inr_paise IS NOT NULL ORDER BY reviewed_at DESC").fetchall()
            members=[dict(r) | {'effective_plan':effective_plan(r)} for r in members]
            revenue=sum(r['paid_inr_paise'] for r in approved)
            # Last seven days of verified manual receipts, not invented analytics.
            now=int(time.time()); buckets=[]
            for ago in range(6,-1,-1):
                start=((now//86400)-ago)*86400
                total=sum(r['paid_inr_paise'] for r in approved if r['reviewed_at'] and start <= r['reviewed_at'] < start+86400)
                buckets.append({'day':time.strftime('%d %b',time.gmtime(start)),'amount_inr_paise':total})
            return self.response(200,{'members':members,'payments':[dict(r) for r in pending],
                        'audit':[dict(r) for r in audits], 'settings':settings,
                        'verified_revenue_inr_paise':revenue,'revenue_7d':buckets})
        if path == '/api/local/models':
            try:
                return self.response(200, {'models':local_runtime.models(),'provider':'Ollama (this computer)','connected':True})
            except local_runtime.LocalModelError as exc:
                return self.response(503, {'models':[], 'connected':False, 'error':str(exc)})
        if path.startswith('/api/local/artifacts/'):
            user=self.find_user()
            if not user:
                return self.response(401, {'error':'Sign in required to download generated files'})
            artifact_id=path.rsplit('/',1)[-1]
            if not re.fullmatch('[a-f0-9]{32}',artifact_id):
                return self.response(404, {'error':'File not found'})
            with database() as conn:
                rec=conn.execute('SELECT id FROM local_artifacts WHERE id=? AND user_id=?',
                                 (artifact_id,user['id'])).fetchone()
            artifact=DATA_DIR/'artifacts'/(artifact_id+'.zip')
            if not rec or not artifact.is_file():
                return self.response(404, {'error':'File not found'})
            payload=artifact.read_bytes()
            self.send_response(200)
            self.headers_common()
            self.send_header('Content-Type','application/zip')
            self.send_header('Content-Disposition', 'attachment; filename="blorp-static-website.zip"')
            self.send_header('Content-Length',str(len(payload)))
            self.end_headers()
            return self.wfile.write(payload)
        if path == '/api/auth/me':
            return self.response(200, {'user': safe_user(self.find_user())})
        if path == '/api/projects':
            user = self.find_user()
            if not user:
                return self.response(401, {'error': 'Sign in required'})
            with database() as conn:
                records = conn.execute('SELECT id,title,payload,updated_at FROM projects WHERE user_id=? ORDER BY updated_at DESC LIMIT 50', (user['id'],)).fetchall()
            return self.response(200, {'projects': [{'id': r['id'], 'title': r['title'], 'payload': json.loads(r['payload']), 'updated_at':r['updated_at']} for r in records]})
        if path.startswith('/api/'):
            return self.response(404, {'error': 'Unknown API endpoint'})
        file_path = (PUBLIC / (path.lstrip('/') or 'index.html')).resolve()
        if not file_path.is_relative_to(PUBLIC.resolve()) or not file_path.is_file():
            self.send_error(404, 'Not found')
            return
        mime = mimetypes.guess_type(str(file_path))[0] or 'application/octet-stream'
        data = file_path.read_bytes()
        self.send_response(200)
        self.headers_common()
        self.send_header('Content-Type', f'{mime}; charset=utf-8' if mime.startswith(('text/','application/javascript')) else mime)
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_POST(self):
        if not self.check_origin():
            return
        path = urlsplit(self.path).path
        data = self.read_json()
        if data is None:
            return self.response(400, {'error': 'Expected a small JSON object'})
        if path == '/api/auth/signup':
            email = str(data.get('email', '')).strip().lower()
            name = str(data.get('name', '')).strip()
            password = data.get('password', '')
            if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+', email) or len(email) > 254 or not (2 <= len(name) <= 55) or not isinstance(password, str) or not (10 <= len(password) <= 128):
                return self.response(422, {'error': 'Use a valid email, name (2–55 chars), and password (10–128 chars)'})
            salt = secrets.token_hex(16)
            user_id = str(uuid.uuid4())
            try:
                with database() as conn:
                    conn.execute('INSERT INTO users(id,email,name,salt,password_hash,credits_remaining,plan,created_at) VALUES (?,?,?,?,?,?,?,?)',
                                 (user_id,email,name,salt,hash_password(password,salt),FREE_CREDITS,'free',int(time.time())))
                    user = conn.execute('SELECT * FROM users WHERE id=?',(user_id,)).fetchone()
            except sqlite3.IntegrityError:
                return self.response(409, {'error': 'Email already registered'})
            return self.response(201, {'user': safe_user(user)}, self.create_session(user))
        if path == '/api/auth/signin':
            email = str(data.get('email','')).strip().lower()
            password = data.get('password','')
            if not allow_attempt(f'{self.client_address[0]}:{email}'):
                return self.response(429, {'error': 'Too many attempts. Try again in one minute.'})
            if not isinstance(password,str):
                return self.response(401, {'error': 'Invalid credentials'})
            with database() as conn:
                user = conn.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
            if not user or not user['password_hash'] or not hmac.compare_digest(hash_password(password,user['salt']),user['password_hash']):
                return self.response(401, {'error': 'Invalid credentials'})
            return self.response(200, {'user': safe_user(user)}, self.create_session(user))
        if path in ('/api/auth/google','/api/auth/google/link'):
            try:
                identity=verify_google_credential(data.get('credential'))
            except (ValueError, RuntimeError) as exc:
                return self.response(503 if isinstance(exc,RuntimeError) else 401,{'error':str(exc)})
            except Exception:
                return self.response(401,{'error':'Google sign-in could not be verified'})
            if path.endswith('/link'):
                user=self.find_user()
                if not user:return self.response(401,{'error':'Sign in with your password before linking Google'})
                if user['email']!=identity['email']:
                    return self.response(409,{'error':'Google email does not match your account'})
                if user['google_sub'] and user['google_sub']!=identity['sub']:
                    return self.response(409,{'error':'A different Google account is already linked'})
                try:
                    with database() as conn:
                        conn.execute('UPDATE users SET google_sub=? WHERE id=?',(identity['sub'],user['id']))
                        user=conn.execute('SELECT * FROM users WHERE id=?',(user['id'],)).fetchone()
                except sqlite3.IntegrityError:
                    return self.response(409,{'error':'Google identity already linked to another account'})
                return self.response(200,{'user':safe_user(user),'linked':True})
            with database() as conn:
                user=conn.execute('SELECT * FROM users WHERE google_sub=?',(identity['sub'],)).fetchone()
                if not user:
                    existing=conn.execute('SELECT id FROM users WHERE email=?',(identity['email'],)).fetchone()
                    if existing:
                        return self.response(409,{'error':'An account already uses this email. Sign in with your password, then link Google from the account settings.'})
                    uid=str(uuid.uuid4())
                    try:
                        conn.execute('''INSERT INTO users(id,email,name,salt,password_hash,credits_remaining,plan,created_at,google_sub)
                            VALUES (?,?,?,?,?,?,?,?,?)''',(uid,identity['email'],identity['name'],'','',FREE_CREDITS,'free',int(time.time()),identity['sub']))
                    except sqlite3.IntegrityError:
                        return self.response(409,{'error':'Account already exists'})
                    user=conn.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
            return self.response(200,{'user':safe_user(user)},self.create_session(user))
        if path == '/api/auth/signout':
            raw = self.headers.get('Cookie','')
            try:
                cookie=SimpleCookie();cookie.load(raw)
                token=cookie[COOKIE].value if COOKIE in cookie else ''
            except Exception:
                token=''
            if token:
                with database() as conn:
                    conn.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
            return self.response(200, {'ok':True}, f'{COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0')
        if path == '/api/billing/attempt':
            user=self.find_user()
            if not user:return self.response(401,{'error':'Sign in required'})
            try:
                with database() as conn:
                    result=payment_checkout.start_attempt(conn,user['id'],data.get('plan'),data.get('interval'),PLAN_PRICES)
                return self.response(201 if result['seconds_remaining']==payment_checkout.WINDOW_SECONDS else 200,result)
            except payment_checkout.CheckoutError as exc:
                return self.response(exc.status,{'error':str(exc)})
        if path == '/api/billing/request':
            user=self.find_user()
            if not user:return self.response(401,{'error':'Sign in required'})
            try:
                with database() as conn:
                    result=payment_checkout.submit_utr(conn,user['id'],data,PLAN_PRICES)
                return self.response(201,result)
            except payment_checkout.CheckoutError as exc:
                return self.response(exc.status,{'error':str(exc)})
        if path == '/api/owner/payments/settings':
            owner=self.find_user()
            if not owner:return self.response(401,{'error':'Sign in required'})
            if owner['role']!='owner':return self.response(403,{'error':'Owner access only'})
            upi_id=str(data.get('upi_id','')).strip()
            amounts=data.get('prices_inr_paise')
            if not re.fullmatch(r'[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,100}',upi_id):
                return self.response(422,{'error':'Enter a valid UPI ID (e.g. merchant@bank)'})
            keys={'builder:monthly','builder:annual','studio:monthly','studio:annual'}
            if not isinstance(amounts,dict) or set(amounts)!=keys or any(type(amounts[k]) is not int or not (100<=amounts[k]<=1000000000) for k in keys):
                return self.response(422,{'error':'Set the four INR amounts in paise (₹1–₹10,000,000)'})
            decoded=mime=None
            if data.get('qr_data_url'):
                try:decoded,mime=validate_qr_image(data['qr_data_url'])
                except ValueError as exc:return self.response(422,{'error':str(exc)})
            if data.get('remove_qr') is True:
                decoded=b'';mime=None
            now=int(time.time())
            with database() as conn:
                conn.execute('BEGIN IMMEDIATE')
                if decoded is None:
                    conn.execute('UPDATE payment_settings SET upi_id=?,prices_inr_json=?,updated_by=?,updated_at=? WHERE id=1',
                        (upi_id,json.dumps(amounts),owner['id'],now))
                else:
                    conn.execute('UPDATE payment_settings SET upi_id=?,prices_inr_json=?,qr_image=?,qr_mime=?,updated_by=?,updated_at=? WHERE id=1',
                        (upi_id,json.dumps(amounts),decoded or None,mime,owner['id'],now))
            return self.response(200,{'ok':True,'message':'Payment settings updated'})
        if path in ('/api/owner/payments/decision','/api/owner/memberships/set'):
            owner=self.find_user()
            if not owner:return self.response(401,{'error':'Sign in required'})
            if owner['role']!='owner':return self.response(403,{'error':'Owner access only'})
            now=int(time.time())
            if path.endswith('/decision'):
                req_id=data.get('request_id'); decision=data.get('decision'); note=str(data.get('note','')).strip()[:240]
                if not isinstance(req_id,str) or not re.fullmatch(r'[a-f0-9]{32}',req_id) or decision not in ('approve','reject'):
                    return self.response(422,{'error':'Invalid payment request or decision'})
                if decision=='approve' and data.get('verified_payment') is not True:
                    return self.response(422,{'error':'Confirm payment independently before activation'})
                with database() as conn:
                    conn.execute('BEGIN IMMEDIATE')
                    request=conn.execute('SELECT * FROM payment_requests WHERE id=?',(req_id,)).fetchone()
                    if not request:return self.response(404,{'error':'Payment request not found'})
                    if request['status']!='pending':return self.response(409,{'error':'Request already reviewed'})
                    user=conn.execute('SELECT * FROM users WHERE id=?',(request['user_id'],)).fetchone()
                    if decision=='approve':
                        if (not request['reference'] or not request['paid_inr_paise'] or
                            data.get('verified_reference','').strip().upper()!=request['reference'] or
                            data.get('verified_amount_paise')!=request['paid_inr_paise']):
                            return self.response(422,{'error':'Owner must independently confirm exact UTR and INR amount before approval'})
                        if len(note)<8:
                            return self.response(422,{'error':'Record a verification note (at least 8 characters)'})
                        old=effective_plan(user)
                        base=max(now,user['plan_expires_at'] or now) if old==request['plan'] else now
                        expires=base+(365 if request['interval']=='annual' else 30)*86400
                        conn.execute('UPDATE users SET plan=?,plan_expires_at=? WHERE id=?',(request['plan'],expires,user['id']))
                        conn.execute('INSERT INTO membership_audit VALUES(?,?,?,?,?,?,?,?)',
                                     (uuid.uuid4().hex,owner['id'],user['id'],old,request['plan'],expires,'Verified manual payment '+req_id,now))
                    conn.execute('''UPDATE payment_requests SET status=?,owner_note=?,reviewed_by=?,reviewed_at=? WHERE id=?''',
                                 ('approved' if decision=='approve' else 'rejected',note,owner['id'],now,req_id))
                return self.response(200,{'ok':True,'status':'approved' if decision=='approve' else 'rejected'})
            member_id=data.get('user_id'); plan=data.get('plan'); days=data.get('days'); reason=str(data.get('reason','')).strip()
            if not isinstance(member_id,str) or plan not in ('free','builder','studio') or type(days) is not int or not 1<=days<=365 or not 5<=len(reason)<=240:
                return self.response(422,{'error':'Choose a member, plan, valid duration and a reason (5–240 chars)'})
            expires=None if plan=='free' else now+days*86400
            with database() as conn:
                conn.execute('BEGIN IMMEDIATE')
                member=conn.execute('SELECT * FROM users WHERE id=?',(member_id,)).fetchone()
                if not member:return self.response(404,{'error':'Member not found'})
                old=effective_plan(member)
                conn.execute('UPDATE users SET plan=?,plan_expires_at=? WHERE id=?',(plan,expires,member_id))
                conn.execute('INSERT INTO membership_audit VALUES(?,?,?,?,?,?,?,?)',
                             (uuid.uuid4().hex,owner['id'],member_id,old,plan,expires,reason,now))
            return self.response(200,{'ok':True,'plan':plan,'plan_expires_at':expires})
        if path == '/api/projects':
            user = self.find_user()
            if not user:
                return self.response(401, {'error': 'Sign in required'})
            name = str(data.get('title','')).strip()
            payload = data.get('payload',{})
            project_id = str(data.get('id') or uuid.uuid4())
            if not name or len(name)>90 or len(project_id)>90 or not isinstance(payload,dict):
                return self.response(422, {'error': 'Invalid project'})
            payload_json = json.dumps(payload,separators=(',',':'),ensure_ascii=False)
            if len(payload_json)>10000:
                return self.response(413, {'error': 'Project draft is too large'})
            with database() as conn:
                conn.execute('''INSERT INTO projects(id,user_id,title,payload,updated_at)
                  VALUES(?,?,?,?,?) ON CONFLICT(id,user_id) DO UPDATE SET
                  title=excluded.title,payload=excluded.payload,updated_at=excluded.updated_at''',
                  (project_id,user['id'],name,payload_json,int(time.time())))
            return self.response(200, {'id': project_id, 'saved':True})
        if path in ('/api/local/chat','/api/local/agents/build'):
            user=self.find_user()
            if not user:
                return self.response(401, {'error':'Sign in with your local Blorp account first'})
            if path.endswith('/build') and not has_build_access(user):
                return self.response(402, {'error':'Build Fast requires an active Builder or Studio membership'})
            model=data.get('model')
            if not isinstance(model,str) or len(model)>110 or not re.fullmatch(r'[a-zA-Z0-9_.:/-]+',model):
                return self.response(422, {'error':'Choose a valid installed Ollama model'})
            brief=data.get('brief' if path.endswith('/build') else 'message','')
            if not isinstance(brief,str) or not (5<=len(brief.strip())<=3000):
                return self.response(422, {'error':'Enter a prompt between 5 and 3000 characters'})
            if not allow_attempt('local-run:'+user['id']):
                return self.response(429, {'error':'Too many local requests; try again in a minute'})
            if not _model_lock.acquire(blocking=False):
                return self.response(429, {'error':'A local inference is already running. Retry when it finishes.'})
            try:
                if model not in local_runtime.models():
                    return self.response(422, {'error':'Model is not installed in local Ollama'})
                if path=='/api/local/chat':
                    history=data.get('history',[])
                    if not isinstance(history,list):
                        return self.response(422, {'error':'Invalid chat history'})
                    chat_messages=[{'role':'system','content':'You are Blorp, a helpful local AI assistant. Be precise, and say when you are uncertain.'}]
                    for msg in history[-10:]:
                        if not isinstance(msg,dict) or msg.get('role') not in ('user','assistant') or not isinstance(msg.get('content'),str) or len(msg['content'])>4000:
                            return self.response(422, {'error':'Invalid chat history message'})
                        chat_messages.append({'role':msg['role'],'content':msg['content']})
                    chat_messages.append({'role':'user','content':brief})
                    answer,usage=local_runtime.chat(model,chat_messages,tokens=1200)
                    return self.response(200, {'reply':answer,'usage':usage,'source':'local-ollama'})
                result=local_runtime.build_website(model,brief.strip())
                artifact_id=uuid.uuid4().hex
                artifact_dir=DATA_DIR/'artifacts'
                artifact_dir.mkdir(parents=True,exist_ok=True)
                (artifact_dir/(artifact_id+'.zip')).write_bytes(local_runtime.archive(result))
                with database() as conn:
                    conn.execute('INSERT INTO local_artifacts(id,user_id,model,created_at) VALUES(?,?,?,?)',
                                 (artifact_id,user['id'],model,int(time.time())))
                return self.response(200, {'plan':result['plan'],'review':result['review'],
                  'files':list(result['files']), 'usage':result['usage'],
                  'download_url':'/api/local/artifacts/'+artifact_id,
                  'source':'local-ollama', 'executed':False})
            except local_runtime.LocalModelError as exc:
                return self.response(502, {'error':str(exc)})
            except Exception:
                self.log_error('Local model operation failed unexpectedly')
                return self.response(500, {'error':'Unexpected local model error; see server diagnostics'})
            finally:
                _model_lock.release()
        if path == '/api/agents/run':
            user=self.find_user()
            if not user:
                return self.response(401, {'error': 'Sign in required'})
            if not has_build_access(user):
                return self.response(402, {'error': 'Build Fast requires an active Builder or Studio membership'})
            # Intentionally fail closed for ALL tiers until isolated runtime and billing exist.
            return self.response(503, {'error': 'Agent execution is not deployed. This server never runs submitted code.'})
        if path.startswith('/api/billing/'):
            return self.response(503, {'error': 'Billing is not connected. No payments are accepted.'})
        return self.response(404, {'error': 'Unknown API endpoint'})


def main():
    init_db()
    global PORT
    requested = PORT
    for candidate in ([requested] if os.environ.get('BLORP_PORT') else [requested, requested + 1, requested + 2, 0]):
        try:
            server = ThreadingHTTPServer((HOST, candidate), Handler)
            PORT = server.server_address[1]
            break
        except OSError:
            if os.environ.get('BLORP_PORT'):
                raise
    else:
        raise RuntimeError('No available localhost port')
    print(f'Blorp V5.1 local server: http://{HOST}:{PORT}', flush=True)
    print('Local development only. Not for public internet or production use.', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
