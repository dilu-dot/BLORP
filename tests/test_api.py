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
        # A key cannot be saved from a cross-origin or Origin-less browser request.
        assert api('/api/provider-keys',{'provider':'openai','key':'fake-development-key-123'},origin='https://attacker.example')[0]==403
        assert api('/api/provider-keys',{'provider':'openai','key':'fake-development-key-123'})[0]==403
        status,metadata=api('/api/provider-keys')
        assert status==200 and metadata['providers']==[] and metadata['live_verification'] is False
        assert 'fake-development-key-123' not in json.dumps(metadata)
        if os.name!='nt':
            assert metadata['storage_available'] is False
            assert api('/api/provider-keys',{'provider':'openai','key':'fake-development-key-123'},origin=url)[0]==503
        assert api('/api/provider-keys',{'provider':'not-supported','key':'fake-development-key-123'},origin=url)[0]==422
        # Provider discovery never accepts arbitrary endpoints or keys from the client.
        assert api('/api/provider-models/discover',{'provider':'openai'},origin='https://attacker.example')[0]==403
        assert api('/api/provider-models/discover',{'provider':'openai'})[0]==403
        assert api('/api/provider-models/discover',{'provider':'https://bad.invalid'},origin=url)[0]==422
        status,discovery=api('/api/provider-models')
        assert status==200 and discovery['checks']==[] and discovery['models_are_not_inference_verified'] is True
        assert api('/api/provider-models/discover',{'provider':'openai'},origin=url)[0] in (404,503)
        status,body=api('/api/agents/run',{});assert status==402 and 'membership' in body['error']
        status,body=api('/api/billing/checkout',{});assert status==503
        status,body=api('/api/local/agents/build',{'model':'unknown','brief':'Build a website'});assert status==402
        status,body=api('/api/projects',{'title':'My first site','payload':{'stack':'React'}});assert status==200;pid=body['id']
        status,body=api('/api/projects');assert status==200 and body['projects'][0]['id']==pid
        # Project changes are persisted per account, not merely in browser storage.
        status,body=api('/api/projects',{'id':pid,'title':'My first site updated','payload':{'type':'Website','chatHistory':[{'role':'user','text':'Hello project'}]}})
        assert status==200 and body['id']==pid
        status,body=api('/api/projects')
        assert status==200 and len(body['projects'])==1 and body['projects'][0]['title']=='My first site updated'
        assert body['projects'][0]['payload']['chatHistory'][0]['text']=='Hello project'
        def delete_project(project_id, origin=None, client=op):
            headers={'Origin':origin} if origin else {}
            req=urllib.request.Request(url+'/api/projects/'+project_id,headers=headers,method='DELETE')
            try:
                with client.open(req,timeout=3) as resp:return resp.status,json.load(resp)
            except urllib.error.HTTPError as exc:return exc.code,json.load(exc)
        other=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        assert delete_project(pid,client=other)[0]==401
        # A different authenticated user cannot read or delete somebody else's project.
        other_signup=urllib.request.Request(url+'/api/auth/signup',
            data=json.dumps({'email':f'other-{uuid.uuid4().hex}@example.test','name':'Other account','password':'AnotherPass123!!'}).encode(),
            headers={'Content-Type':'application/json'})
        with other.open(other_signup,timeout=3) as resp: assert resp.status==201
        with other.open(url+'/api/projects',timeout=3) as resp:
            assert json.load(resp)['projects']==[]
        assert delete_project(pid,client=other)[0]==404
        assert delete_project(pid,origin='https://attacker.example')[0]==403
        assert delete_project('not-your-project')[0]==404
        assert delete_project(pid)[0]==200
        assert delete_project(pid)[0]==404
        assert api('/api/projects')[1]['projects']==[]
        status,body=api('/api/auth/signout',{});assert status==200
        status,body=api('/api/auth/me');assert body['user'] is None
        status,body=api('/api/auth/signup',{'email':'x@y.com','name':'Bad','password':'weak'});assert status==422
        status,body=api('/api/auth/signup',{'email':'x@y.com','name':'Test','password':'ALongSecret123'},origin='https://attacker.example');assert status==403
        print('API tests passed: sessions, credits, auth, blocked execution, project persistence, origin guard')
    finally:
        proc.terminate();proc.wait(timeout=5)
