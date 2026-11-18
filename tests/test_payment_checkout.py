"""Deterministic checkout invariants; all UPI data below is fictional."""
import json
import sqlite3
import unittest
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import payment_checkout as checkout

PRICES={('builder','monthly'):2000,('builder','annual'):21600,('studio','monthly'):5000,('studio','annual'):54000}
AMOUNTS={'builder:monthly':169900,'builder:annual':1800000,'studio:monthly':429900,'studio:annual':4599900}

def database():
    conn=sqlite3.connect(':memory:')
    conn.row_factory=sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.executescript("""
        CREATE TABLE users(id TEXT PRIMARY KEY);
        CREATE TABLE payment_settings(id INTEGER PRIMARY KEY,upi_id TEXT,prices_inr_json TEXT,qr_image BLOB,updated_at INTEGER);
        CREATE TABLE payment_requests(id TEXT PRIMARY KEY,user_id TEXT,plan TEXT,interval TEXT,amount_cents INTEGER,currency TEXT,method TEXT,status TEXT,reference TEXT,paid_inr_paise INTEGER,payer_name TEXT,created_at INTEGER);
    """)
    conn.executemany('INSERT INTO users(id) VALUES (?)',[('a',),('b',)])
    conn.execute('INSERT INTO payment_settings VALUES(1,?,?,?,?)',('fake@bank',json.dumps(AMOUNTS),b'test-fake-image',100))
    conn.execute("CREATE UNIQUE INDEX payments_unique_submitted_utr ON payment_requests(UPPER(reference)) WHERE reference<>'' AND method='manual'")
    checkout.init_schema(conn)
    return conn

class CheckoutTests(unittest.TestCase):
    def setUp(self):
        self.conn=database()
        self.addCleanup(self.conn.close)
    def start(self,user='a',plan='builder',when=1000):
        with self.conn:return checkout.start_attempt(self.conn,user,plan,'monthly',PRICES,now=when)
    def submit(self,attempt,user='a',when=1100,reference='TEST123456789'):
        with self.conn:return checkout.submit_utr(self.conn,user,{'attempt_id':attempt['attempt_id'],'plan':attempt['plan'],'interval':attempt['interval'],'payer_name':'Test Payer','reference':reference},PRICES,now=when)
    def denied(self,code,fn):
        with self.assertRaises(checkout.CheckoutError) as e:fn()
        self.assertEqual(e.exception.status,code)
    def test_timeout_and_reuse(self):
        attempt=self.start()
        self.assertEqual(attempt['seconds_remaining'],300)
        self.assertEqual(self.start()['attempt_id'],attempt['attempt_id'])
        self.denied(409,lambda:self.start(plan='studio',when=1001))
        self.denied(410,lambda:self.submit(attempt,when=1300))
        self.assertEqual(checkout.get_attempt(self.conn,'a',attempt['attempt_id'],now=1300)['status'],'expired')
        self.assertNotEqual(self.start(when=1300)['attempt_id'],attempt['attempt_id'])
    def test_submit_once_and_no_auto_approval(self):
        attempt=self.start()
        result=self.submit(attempt)
        self.assertEqual(result['status'],'pending')
        self.denied(409,lambda:self.submit(attempt,reference='DIFFERENT123'))
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM payment_requests').fetchone()[0],1)
    def test_cross_account_and_duplicate_utr(self):
        a=self.start()
        self.denied(404,lambda:self.submit(a,user='b'))
        self.denied(404,lambda:checkout.get_attempt(self.conn,'b',a['attempt_id']))
        self.submit(a,reference='DUPLICATE1234')
        b=self.start(user='b',when=1101)
        self.denied(409,lambda:self.submit(b,user='b',when=1110,reference='DUPLICATE1234'))
    def test_changed_payment_config(self):
        a=self.start()
        with self.conn:self.conn.execute('UPDATE payment_settings SET updated_at=200 WHERE id=1')
        self.denied(409,lambda:self.submit(a))
        self.assertEqual(self.conn.execute('SELECT COUNT(*) FROM payment_requests').fetchone()[0],0)
    def test_not_configured(self):
        self.denied(422,lambda:self.start(plan='invalid'))
        with self.conn:self.conn.execute('UPDATE payment_settings SET qr_image=NULL WHERE id=1')
        self.denied(503,lambda:self.start())
    def test_attempt_rate_limit(self):
        for i in range(6):self.start(when=1000+i*301)
        self.denied(429,lambda:self.start(when=1000+6*301))

if __name__=='__main__':
    unittest.main()
