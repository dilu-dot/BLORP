"""BLORP localhost payment-attempt state machine. No bank/UPI verification or charging.

All timestamps come from this server; browser timers cannot authorize late UTRs.
"""
from __future__ import annotations

import json
import re
import sqlite3
import time
import uuid

WINDOW_SECONDS = 300


class CheckoutError(Exception):
    def __init__(self, status: int, message: str):
        super().__init__(message)
        self.status = status


def init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript('''
        CREATE TABLE IF NOT EXISTS payment_attempts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plan TEXT NOT NULL CHECK(plan IN ('builder','studio')),
          interval TEXT NOT NULL CHECK(interval IN ('monthly','annual')),
          amount_cents INTEGER NOT NULL,
          paid_inr_paise INTEGER NOT NULL,
          upi_id TEXT NOT NULL,
          config_updated_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','submitted','expired')),
          request_id TEXT
        );
        CREATE INDEX IF NOT EXISTS payment_attempts_recent ON payment_attempts(user_id,created_at);
    ''')
    columns = {row['name'] for row in conn.execute('PRAGMA table_info(payment_requests)')}
    if 'attempt_id' not in columns:
        conn.execute('ALTER TABLE payment_requests ADD COLUMN attempt_id TEXT')
    conn.execute('CREATE UNIQUE INDEX IF NOT EXISTS payment_requests_attempt_unique ON payment_requests(attempt_id) WHERE attempt_id IS NOT NULL')


def _config(conn: sqlite3.Connection, plan: str, interval: str) -> tuple[str, int, int]:
    row = conn.execute('SELECT * FROM payment_settings WHERE id=1').fetchone()
    if not row or not row['qr_image'] or not row['upi_id']:
        raise CheckoutError(503, 'Owner has not configured a UPI QR and payment details')
    try:
        amount = json.loads(row['prices_inr_json']).get(f'{plan}:{interval}')
    except (ValueError, TypeError, AttributeError):
        amount = None
    if type(amount) is not int or not 100 <= amount <= 1_000_000_000:
        raise CheckoutError(503, 'Owner has not configured the exact INR price for this plan')
    return row['upi_id'], amount, int(row['updated_at'] or 0)


def _public(row: sqlite3.Row, now: int) -> dict:
    status = 'expired' if row['status'] == 'open' and row['expires_at'] <= now else row['status']
    return {
        'attempt_id': row['id'], 'plan': row['plan'], 'interval': row['interval'],
        'status': status, 'amount_cents': row['amount_cents'],
        'paid_inr_paise': row['paid_inr_paise'], 'currency': 'INR',
        'upi_id': row['upi_id'], 'created_at': row['created_at'],
        'expires_at': row['expires_at'], 'server_time': now,
        'seconds_remaining': max(0, row['expires_at']-now) if status == 'open' else 0,
        'qr_url': '/api/billing/qr', 'manual_approval': True,
    }


def get_attempt(conn: sqlite3.Connection, user_id: str, attempt_id: str, *, now: int | None = None) -> dict:
    if not isinstance(attempt_id, str) or not re.fullmatch(r'[0-9a-f]{32}', attempt_id):
        raise CheckoutError(422, 'Invalid checkout attempt')
    row = conn.execute('SELECT * FROM payment_attempts WHERE id=? AND user_id=?', (attempt_id, user_id)).fetchone()
    if row is None:
        raise CheckoutError(404, 'Checkout attempt not found')
    return _public(row, int(time.time()) if now is None else now)


def start_attempt(conn: sqlite3.Connection, user_id: str, plan: str, interval: str, prices: dict, *, now: int | None = None) -> dict:
    if (plan, interval) not in prices:
        raise CheckoutError(422, 'Choose a valid membership plan and interval')
    now = int(time.time()) if now is None else now
    conn.execute('BEGIN IMMEDIATE')
    upi_id, amount, version = _config(conn, plan, interval)
    pending = conn.execute("SELECT COUNT(*) FROM payment_requests WHERE user_id=? AND status='pending'", (user_id,)).fetchone()[0]
    if pending >= 3:
        raise CheckoutError(429, 'Up to three pending payment requests are allowed')
    conn.execute("UPDATE payment_attempts SET status='expired' WHERE user_id=? AND status='open' AND expires_at<=?", (user_id, now))
    active = conn.execute("SELECT * FROM payment_attempts WHERE user_id=? AND status='open' AND expires_at>? ORDER BY created_at DESC LIMIT 1", (user_id, now)).fetchone()
    if active:
        if (active['plan'], active['interval'], active['paid_inr_paise'], active['config_updated_at']) != (plan, interval, amount, version):
            raise CheckoutError(409, 'Another checkout is active. Finish it or wait for its five-minute window to end')
        return _public(active, now)
    recent = conn.execute('SELECT COUNT(*) FROM payment_attempts WHERE user_id=? AND created_at>?', (user_id, now-3600)).fetchone()[0]
    if recent >= 6:
        raise CheckoutError(429, 'Too many checkout attempts. Try again later')
    attempt_id = uuid.uuid4().hex
    conn.execute('''INSERT INTO payment_attempts
        (id,user_id,plan,interval,amount_cents,paid_inr_paise,upi_id,config_updated_at,created_at,expires_at,status)
        VALUES (?,?,?,?,?,?,?,?,?,?,'open')''',
        (attempt_id,user_id,plan,interval,prices[(plan,interval)],amount,upi_id,version,now,now+WINDOW_SECONDS))
    return get_attempt(conn, user_id, attempt_id, now=now)


def submit_utr(conn: sqlite3.Connection, user_id: str, payload: dict, prices: dict, *, now: int | None = None) -> dict:
    plan, interval = payload.get('plan'), payload.get('interval')
    if (plan, interval) not in prices or payload.get('method', 'manual') != 'manual':
        raise CheckoutError(422, 'Choose a valid manual UPI payment plan')
    attempt_id = payload.get('attempt_id')
    if not isinstance(attempt_id, str) or not re.fullmatch(r'[0-9a-f]{32}', attempt_id):
        raise CheckoutError(422, 'Start a timed checkout before submitting a UTR')
    reference = str(payload.get('reference', '')).strip().upper()
    payer_name = str(payload.get('payer_name', '')).strip()
    if not re.fullmatch(r'[A-Z0-9-]{8,35}', reference):
        raise CheckoutError(422, 'Enter a valid 8–35 character UTR / transaction reference')
    if not 2 <= len(payer_name) <= 80:
        raise CheckoutError(422, 'Enter the name used for the UPI payment')
    now = int(time.time()) if now is None else now
    conn.execute('BEGIN IMMEDIATE')
    attempt = conn.execute('SELECT * FROM payment_attempts WHERE id=? AND user_id=?', (attempt_id,user_id)).fetchone()
    if attempt is None:
        raise CheckoutError(404, 'Checkout attempt not found for this account')
    if (attempt['plan'], attempt['interval']) != (plan, interval):
        raise CheckoutError(422, 'Checkout attempt belongs to a different plan')
    if attempt['status'] != 'open':
        raise CheckoutError(409, 'Checkout attempt was already used or has expired')
    if attempt['expires_at'] <= now:
        raise CheckoutError(410, 'Five-minute UTR window expired. Start a new checkout; do not pay twice')
    upi_id, amount, version = _config(conn, plan, interval)
    if (upi_id, amount, version) != (attempt['upi_id'], attempt['paid_inr_paise'], attempt['config_updated_at']):
        raise CheckoutError(409, 'Owner payment details changed. Contact the owner before paying')
    pending = conn.execute("SELECT COUNT(*) FROM payment_requests WHERE user_id=? AND status='pending'", (user_id,)).fetchone()[0]
    if pending >= 3:
        raise CheckoutError(429, 'Up to three pending payment requests are allowed')
    request_id = uuid.uuid4().hex
    try:
        conn.execute('''INSERT INTO payment_requests
            (id,user_id,plan,interval,amount_cents,currency,method,status,reference,paid_inr_paise,payer_name,created_at,attempt_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)''',
            (request_id,user_id,plan,interval,attempt['amount_cents'],'USD','manual','pending',reference,amount,payer_name,now,attempt_id))
    except sqlite3.IntegrityError as exc:
        raise CheckoutError(409, 'UTR or checkout was already submitted. Contact the owner if this is your payment') from exc
    conn.execute("UPDATE payment_attempts SET status='submitted',request_id=? WHERE id=?", (request_id,attempt_id))
    return {
        'request_id': request_id, 'attempt_id':attempt_id, 'status':'pending',
        'reference':reference, 'paid_inr_paise':amount, 'currency':'INR',
        'message':'Pending independent owner verification. This does not confirm payment or activate membership.',
    }
