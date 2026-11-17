"""Owner authorization, plan locks, Google disabled, payment workflow and expirations."""
from pathlib import Path
import http.cookiejar, json, os, socket, sqlite3, subprocess, sys, tempfile, time, urllib.request, urllib.error

ROOT=Path(__file__).resolve().parents[1]
with socket.socket() as s:
    s.bind(('127.0.0.1',0));PORT=s.getsockname()[1]
with tempfile.TemporaryDirectory() as temporary:
    env=dict(os.environ,BLORP_DATA_DIR=temporary,BLORP_PORT=str(PORT))
    env.pop('BLORP_GOOGLE_CLIENT_ID',None)
    env.pop('BLORP_PAYMENT_INSTRUCTIONS',None)
    proc=subprocess.Popen([sys.executable,str(ROOT/'server.py')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        origin=f'http://127.0.0.1:{PORT}'
        def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        user_client, owner_client=client(),client()
        def api(op,path,payload=None):
            req=urllib.request.Request(origin+path, data=json.dumps(payload).encode() if payload is not None else None,
                                       headers={'Content-Type':'application/json'} if payload is not None else {})
            try:
                with op.open(req,timeout=4) as res:return res.status,json.load(res)
            except urllib.error.HTTPError as e:return e.code,json.load(e)
        for attempt in range(70):
            try:api(user_client,'/api/health');break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('Server unavailable')
        def signup(op,email):
            code,body=api(op,'/api/auth/signup',{'email':email,'name':'Build Tester','password':'TestingPassword123!!'})
            assert code==201,body
            return body['user']
        user=signup(user_client,'member@example.test')
        owner=signup(owner_client,'owner@example.test')
        assert user['role']=='member' and user['plan']=='free' and not user['build_fast_unlocked']
        assert api(user_client,'/api/owner/overview')[0]==403
        assert api(user_client,'/api/owner/memberships/set',{'user_id':owner['id'],'plan':'studio','days':30,'reason':'Bad input'})[0]==403
        assert api(user_client,'/api/local/agents/build',{'model':'dummy','brief':'Build a website'})[0]==402
        assert api(user_client,'/api/agents/run',{})[0]==402
        assert api(user_client,'/api/auth/google',{'credential':'fake'})[0]==503
        assert api(user_client,'/api/billing/request',{'plan':'studio','interval':'monthly','method':'hosted_link'})[0]==503
        code,result=api(user_client,'/api/billing/request',{'plan':'builder','interval':'annual','amount_cents':1,'method':'manual'})
        assert code==201 and result['amount_cents']==21600 and result['status']=='pending', result
        assert api(user_client,'/api/auth/me')[1]['user']['plan']=='free'
        payid=result['request_id']
        cmd=[sys.executable,str(ROOT/'manage_owner.py'),'owner@example.test']
        ran=subprocess.run(cmd,env=env,capture_output=True,text=True,timeout=8)
        assert ran.returncode==0,ran.stderr
        assert api(owner_client,'/api/auth/me')[1]['user']['role']=='owner'
        assert api(owner_client,'/api/owner/overview')[0]==200
        assert api(owner_client,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve'})[0]==422
        assert api(user_client,'/api/auth/me')[1]['user']['plan']=='free'
        code,answer=api(owner_client,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve','verified_payment':True,'note':'Verified externally'})
        assert code==200 and answer['status']=='approved',answer
        assert api(owner_client,'/api/owner/payments/decision',{'request_id':payid,'decision':'approve','verified_payment':True})[0]==409
        result=api(user_client,'/api/auth/me')[1]['user']
        assert result['plan']=='builder' and result['build_fast_unlocked'] and result['plan_expires_at']>time.time()
        assert api(user_client,'/api/agents/run',{})[0]==503
        # Expiration is checked server side even if SQLite retains the old stored paid plan.
        with sqlite3.connect(str(Path(temporary)/'blorp.sqlite3')) as db:
            db.execute('UPDATE users SET plan_expires_at=? WHERE id=?',(int(time.time())-1,user['id']))
        result=api(user_client,'/api/auth/me')[1]['user']
        assert result['plan']=='free' and result['build_fast_unlocked'] is False
        assert api(user_client,'/api/agents/run',{})[0]==402
        # Owner may directly grant complimentary access, and may revoke it.
        code,body=api(owner_client,'/api/owner/memberships/set',{'user_id':user['id'],'plan':'studio','days':14,'reason':'Complimentary QA test'})
        assert code==200 and body['plan']=='studio'
        assert api(user_client,'/api/auth/me')[1]['user']['plan']=='studio'
        code,_=api(owner_client,'/api/owner/memberships/set',{'user_id':user['id'],'plan':'free','days':1,'reason':'QA test finished'})
        assert code==200 and api(user_client,'/api/auth/me')[1]['user']['plan']=='free'
        assert len(api(owner_client,'/api/owner/overview')[1]['audit'])==3
        assert api(owner_client,'/api/billing/plans')[1]['plans'][1]['amount_cents'] in (21600,5000)
        print('PASS: owner gate, pending payments, verified approval, paid runtime lock, expiration, audit and Google config guard')
    finally:
        proc.terminate();proc.wait(timeout=5)
