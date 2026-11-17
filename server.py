"""Blorp V5.1 local development server — Python standard library only.

This is a localhost foundation, NOT a production authentication or payment service.
Use: py -3 server.py (Windows) or python3 server.py.
"""
from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlsplit
import hashlib
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

import local_runtime

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
        CREATE TABLE IF NOT EXISTS local_artifacts (
           id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
           model TEXT NOT NULL, created_at INTEGER NOT NULL);
        ''')


def hash_password(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), bytes.fromhex(salt), ITERATIONS).hex()


def safe_user(row):
    if row is None:
        return None
    return {'id': row['id'], 'name': row['name'], 'email': row['email'],
            'plan': row['plan'], 'credits_remaining': row['credits_remaining']}


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
    server_version = 'BlorpLocal/0.5'

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
        if length < 1 or length > MAX_JSON:
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
            return self.response(200, {'ok': True, 'version': 'v5.1-local-agents', 'ai_connected': False, 'local_ollama_supported': True, 'billing_connected': False})
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
            if not user or not hmac.compare_digest(hash_password(password,user['salt']),user['password_hash']):
                return self.response(401, {'error': 'Invalid credentials'})
            return self.response(200, {'user': safe_user(user)}, self.create_session(user))
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
            if not self.find_user():
                return self.response(401, {'error': 'Sign in required'})
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
