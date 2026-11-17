"""Mock Ollama regression tests: no models are downloaded or queried."""
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from pathlib import Path
from threading import Thread
import tempfile,subprocess,os,sys,urllib.request,urllib.error,json,http.cookiejar,socket,zipfile,io,time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import local_runtime

root=Path(__file__).resolve().parents[1]
def free_port():
    with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]

class FakeOllama(BaseHTTPRequestHandler):
    def log_message(self,*args):pass
    def respond(self,obj):
        raw=json.dumps(obj).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/api/tags':return self.respond({'models':[{'name':'test-coder:3b'}]})
        self.send_error(404)
    def do_POST(self):
        size=int(self.headers.get('Content-Length','0'));body=json.loads(self.rfile.read(size));sysmessage=body['messages'][0]['content']
        if body.get('format')=='json':text=json.dumps({'files':{'index.html':'<!doctype html><html><head><link rel="stylesheet" href="styles.css"></head><body><h1>Hello Blorp</h1><script src="script.js"></script></body></html>','styles.css':'body{background:#123;color:#fff}','script.js':'console.log("local")'}})
        elif 'QA Reviewer' in sysmessage:text='Static review only: check keyboard focus and contrast.'
        elif 'Architect' in sysmessage:text='Implement a responsive single-page site with heading and CSS.'
        else:text='Hello from the local model.'
        self.respond({'message':{'content':text},'prompt_eval_count':20,'eval_count':42})

ollama_port=free_port();ollama=ThreadingHTTPServer(('127.0.0.1',ollama_port),FakeOllama);Thread(target=ollama.serve_forever,daemon=True).start()
blorp_port=free_port()
with tempfile.TemporaryDirectory() as tmp:
    env=dict(os.environ,BLORP_DATA_DIR=tmp,BLORP_PORT=str(blorp_port),BLORP_OLLAMA_PORT=str(ollama_port))
    proc=subprocess.Popen([sys.executable,str(root/'server.py')],env=env,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
    try:
        url=f'http://127.0.0.1:{blorp_port}'
        jar=http.cookiejar.CookieJar();client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        for _ in range(80):
            try:client.open(url+'/api/health',timeout=.5);break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('Blorp failed to start')
        def request(path,payload=None):
            headers={'Content-Type':'application/json'} if payload is not None else {}
            req=urllib.request.Request(url+path,data=json.dumps(payload).encode() if payload is not None else None,headers=headers)
            try:
                with client.open(req,timeout=30) as res:
                    return res.status,json.load(res)
            except urllib.error.HTTPError as res:return res.code,json.load(res)
        assert request('/api/local/models')[1]['models']==['test-coder:3b']
        assert request('/api/local/chat',{'model':'test-coder:3b','message':'Hello there'})[0]==401
        status,data=request('/api/auth/signup',{'email':'agent-test@blorp.local','name':'Test Agent','password':'MyStrongPassw0rd!'})
        assert status==201
        status,chat=request('/api/local/chat',{'model':'test-coder:3b','message':'Hello there'})
        assert status==200 and chat['reply']=='Hello from the local model.' and chat['source']=='local-ollama'
        status,run=request('/api/local/agents/build',{'model':'test-coder:3b','brief':'Build a beautiful coffee shop website'})
        assert status==200,(status,run)
        assert run['executed'] is False and len(run['files'])==3
        assert 'review' in run and 'plan' in run
        with client.open(url+run['download_url'],timeout=10) as res:
            assert res.headers['Content-Type']=='application/zip'
            package=res.read()
        with zipfile.ZipFile(io.BytesIO(package)) as z:
            assert {'index.html','styles.css','script.js','BLORP_REVIEW.txt'}==set(z.namelist())
        # Artifact downloads must not be accessible to another local account.
        other_jar=http.cookiejar.CookieJar()
        other_client=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(other_jar))
        other_signup=urllib.request.Request(url+'/api/auth/signup',data=json.dumps({'email':'second@blorp.local','name':'Other Test','password':'AnotherStrongPassw0rd!'}).encode(),headers={'Content-Type':'application/json'})
        with other_client.open(other_signup,timeout=10) as res:
            assert res.status==201
        try:
            other_client.open(url+run['download_url'],timeout=10)
            raise AssertionError('Cross-account artifact download unexpectedly succeeded')
        except urllib.error.HTTPError as err:
            assert err.code==404,err.code
        status,denied=request('/api/agents/run',{});assert status==503
        status,denied=request('/api/local/chat',{'model':'madeup','message':'Hello there'});assert status==422
        print('Local agent tests passed: Ollama discovery, authenticated chat, 3-role pipeline, ZIP download, blocked external execution.')
    finally:
        proc.terminate();proc.wait(timeout=5);ollama.shutdown()

# Strict packaging: reject model-supplied path traversal or external network calls.
for bad in [
  {'files':{'../../malicious.py':'print(1)','index.html':'hi'}},
  {'files':{'index.html':'<script src="https://example.com/x.js"></script>'}},
  {'files':{'index.html':'<h1>hi</h1>','script.js':'fetch("/secret")'}}
]:
    try:
        local_runtime.parse_files(json.dumps(bad))
        raise AssertionError('Unsafe generated files unexpectedly accepted')
    except local_runtime.LocalModelError:
        pass
