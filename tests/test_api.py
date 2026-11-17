from pathlib import Path
import http.cookiejar
import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import uuid

root=Path(__file__).resolve().parents[1]
with socket.socket() as s:
    s.bind(('127.0.0.1',0));port=s.getsockname()[1]
with tempfile.TemporaryDirectory() as temp:
    env=dict(os.environ,BLORP_DATA_DIR=temp,BLORP_PORT=str(port))
    proc=subprocess.Popen([sys.executable,str(root/'server.py')],env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    try:
        url=f'http://127.0.0.1:{port}'
        jar=http.cookiejar.CookieJar()
        op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        for _ in range(60):
            try:op.open(url+'/api/health',timeout=1);break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('Server not started')
        def api(path, data=None, origin=None):
            h={'Content-Type':'application/json'} if data is not None else {}
            if origin: h['Origin']=origin
            request=urllib.request.Request(url+path, data=json.dumps(data).encode() if data is not None else None,headers=h)
            try:
                with op.open(request,timeout=3) as resp:return resp.status,json.load(resp)
            except urllib.error.HTTPError as e:return e.code,json.load(e)
        assert api('/api/auth/me')==(200,{'user':None})
        status,body=api('/api/auth/signup',{'email':f'v5-{uuid.uuid4().hex}@example.com','name':'Blorp Test','password':'TestPassw0rd!234'})
        print('signup',status,body['user']['credits_remaining']);assert status==201 and body['user']['credits_remaining']==4_000_000 and body['user']['plan']=='free'
        status,body=api('/api/auth/me');assert status==200 and body['user']['name']=='Blorp Test'
        status,body=api('/api/agents/run',{});assert status==503 and 'not deployed' in body['error']
        status,body=api('/api/billing/checkout',{});assert status==503
        status,body=api('/api/projects',{'title':'My first site','payload':{'stack':'React'}});assert status==200;pid=body['id']
        status,body=api('/api/projects');assert status==200 and body['projects'][0]['id']==pid
        status,body=api('/api/auth/signout',{});assert status==200
        status,body=api('/api/auth/me');assert body['user'] is None
        status,body=api('/api/auth/signup',{'email':'x@y.com','name':'Bad','password':'weak'});assert status==422
        status,body=api('/api/auth/signup',{'email':'x@y.com','name':'Test','password':'ALongSecret123'},origin='https://attacker.example');assert status==403
        print('API tests passed: sessions, credits, auth, blocked execution, project persistence, origin guard')
    finally:
        proc.terminate();proc.wait(timeout=5)
