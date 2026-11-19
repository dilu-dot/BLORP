"""Owner-only QR setup, INR prices, UTR duplicate defense, payment approvals, membership expiry."""
from pathlib import Path
from contextlib import closing
import base64, http.cookiejar, json, os, socket, sqlite3, struct, subprocess, sys, tempfile, time, urllib.request, urllib.error, zlib

ROOT=Path(__file__).resolve().parents[1]

def test_png():
    # A valid small PNG built with the Python standard library; no bank QR used in tests.
    def chunk(tag,buf):return struct.pack('>I',len(buf))+tag+buf+struct.pack('>I',zlib.crc32(tag+buf)&0xffffffff)
    width,height=48,48
    body=b''.join(b'\x00'+b'\xff\xff\xff'*width for _ in range(height))
    raw=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',width,height,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(body,0))+chunk(b'IEND',b'')
    return 'data:image/png;base64,'+base64.b64encode(raw).decode()

with socket.socket() as sock:
    sock.bind(('127.0.0.1',0));PORT=sock.getsockname()[1]
with tempfile.TemporaryDirectory() as temporary:
    env=dict(os.environ,BLORP_DATA_DIR=temporary,BLORP_PORT=str(PORT))
    env.pop('BLORP_GOOGLE_CLIENT_ID',None)
    proc=subprocess.Popen([sys.executable,str(ROOT/'server.py')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        origin=f'http://127.0.0.1:{PORT}'
        def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        customer,owner,other=client(),client(),client()
        def api(op,path,payload=None):
            request=urllib.request.Request(origin+path,data=json.dumps(payload).encode() if payload is not None else None,headers={'Content-Type':'application/json'} if payload is not None else {})
            try:
                with op.open(request,timeout=5) as res:
                    ctype=res.headers.get('Content-Type','')
                    return res.status,json.load(res) if ctype.startswith('application/json') else res.read()
            except urllib.error.HTTPError as exc:return exc.code,json.load(exc)
        for attempt in range(70):
            try:api(customer,'/api/health');break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('Server unavailable')
        def signup(op,email):
            code,result=api(op,'/api/auth/signup',{'email':email,'name':'Blorp Tester','password':'TestingPassword123!!'})
            assert code==201,result
            return result['user']
        c=signup(customer,'customer@example.test')
        o=signup(owner,'owner@example.test')
        signup(other,'other@example.test')
        assert api(customer,'/api/owner/overview')[0]==403
        assert api(customer,'/api/owner/payments/settings',{'upi_id':'fake@upi'})[0]==403
        assert api(customer,'/api/local/agents/build',{'model':'a','brief':'Build a portfolio'})[0]==402
        assert api(customer,'/api/billing/qr')[0]==404
        # Without an owner-configured QR and price there can be no payment submission.
        payload={'plan':'builder','interval':'annual','method':'manual','payer_name':'Test Payer','reference':'123456789012'}
        assert api(customer,'/api/billing/attempt',{'plan':'builder','interval':'annual'})[0]==503
        assert api(customer,'/api/billing/request',payload)[0]==422, 'UTR must have a server-issued checkout ID'
        assert api(customer,'/api/auth/google',{'credential':'fake'})[0]==503
        result=subprocess.run([sys.executable,str(ROOT/'manage_owner.py'),'owner@example.test'],env=env,capture_output=True,text=True,timeout=8)
        assert result.returncode==0,result.stderr
        assert api(owner,'/api/auth/me')[1]['user']['role']=='owner'
        config={'upi_id':'blorp@bank','prices_inr_paise':{'builder:monthly':169900,'builder:annual':1800000,'studio:monthly':429900,'studio:annual':4599900},'qr_data_url':test_png()}
        assert api(owner,'/api/owner/payments/settings',config)[0]==200
        qr_code,qr_bytes=api(customer,'/api/billing/qr')
        assert qr_code==200 and qr_bytes.startswith(b'\x89PNG')
        assert api(customer,'/api/owner/payments/settings',config)[0]==403
        prices=api(customer,'/api/billing/plans')[1]['upi']
        assert prices['qr_configured'] and prices['prices_inr_paise']['builder:annual']==1800000
        code, attempt=api(customer,'/api/billing/attempt',{'plan':'builder','interval':'annual'})
        assert code==201 and attempt['status']=='open' and 0<attempt['seconds_remaining']<=300
        assert attempt['paid_inr_paise']==1800000
        assert api(customer,'/api/billing/attempt',{'plan':'builder','interval':'annual'})[1]['attempt_id']==attempt['attempt_id']
        assert api(other,'/api/billing/attempt?id='+attempt['attempt_id'])[0]==404, 'Attempt is account-scoped'
        # Another user's checkout cannot authorize this user's UTR.
        code,other_attempt=api(other,'/api/billing/attempt',{'plan':'builder','interval':'annual'})
        assert code==201
        assert api(customer,'/api/billing/request',{**payload,'attempt_id':other_attempt['attempt_id']})[0]==404
        # Expires at the server even if the client displays a modified countdown.
        with closing(sqlite3.connect(str(Path(temporary)/'blorp.sqlite3'))) as db, db:
            db.execute('UPDATE payment_attempts SET expires_at=? WHERE id=?',(int(time.time())-1,other_attempt['attempt_id']))
        assert api(other,'/api/billing/request',{**payload,'attempt_id':other_attempt['attempt_id']})[0]==410
        other_attempt=api(other,'/api/billing/attempt',{'plan':'builder','interval':'annual'})[1]
        result_code,request=api(customer,'/api/billing/request',{**payload,'attempt_id':attempt['attempt_id']})
        assert result_code==201 and request['paid_inr_paise']==1800000 and request['status']=='pending',request
        payid=request['request_id']
        assert api(customer,'/api/billing/request',{**payload,'attempt_id':attempt['attempt_id'],'reference':'DIFFERENTREF123'})[0]==409, 'Attempt is one-time use'
        assert api(other,'/api/billing/request',{**payload,'attempt_id':other_attempt['attempt_id']})[0]==409, 'Duplicate UTR must be blocked globally'
        assert api(customer,'/api/auth/me')[1]['user']['plan']=='free'
        assert api(customer,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve','verified_payment':True})[0]==403
        assert api(owner,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve','verified_payment':True,'note':'Verified independently'})[0]==422
        assert api(owner,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve','verified_payment':True,'verified_reference':'WRONG123','verified_amount_paise':1800000,'note':'Verified independently'})[0]==422
        assert api(owner,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve','verified_payment':True,'verified_reference':'123456789012','verified_amount_paise':1,'note':'Verified independently'})[0]==422
        assert api(customer,'/api/auth/me')[1]['user']['plan']=='free'
        code,r=api(owner,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve','verified_payment':True,'verified_reference':'123456789012','verified_amount_paise':1800000,'note':'Verified on merchant bank statement'})
        assert code==200 and r['status']=='approved',r
        assert api(owner,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve','verified_payment':True,'verified_reference':'123456789012','verified_amount_paise':1800000,'note':'Verified independently'})[0]==409
        result=api(customer,'/api/auth/me')[1]['user']
        assert result['plan']=='builder' and result['build_fast_unlocked'] and result['plan_expires_at']>time.time()
        overview=api(owner,'/api/owner/overview')[1]
        assert overview['verified_revenue_inr_paise']==1800000
        assert overview['payments'][0]['reference']=='123456789012'
        assert len(overview['revenue_7d'])==7
        with closing(sqlite3.connect(str(Path(temporary)/'blorp.sqlite3'))) as db, db:
            db.execute('UPDATE users SET plan_expires_at=? WHERE id=?',(int(time.time())-1,c['id']))
        assert api(customer,'/api/auth/me')[1]['user']['plan']=='free'
        assert api(customer,'/api/agents/run',{})[0]==402
        assert api(owner,'/api/owner/memberships/set',{'user_id':c['id'],'plan':'studio','days':14,'reason':'Complimentary QA test'})[0]==200
        assert api(customer,'/api/auth/me')[1]['user']['plan']=='studio'
        assert api(owner,'/api/owner/memberships/set',{'user_id':c['id'],'plan':'free','days':1,'reason':'QA test finished'})[0]==200
        assert api(customer,'/api/auth/me')[1]['user']['plan']=='free'
        print('PASS: owner controls, server-issued 5m attempt, expiry, cross-user safety, duplicate UTR, verified approval, revenue, audit')
    finally:
        proc.terminate();proc.wait(timeout=5)
