/* BLORP runtime diagnostics: truthful status instead of assuming the V4 preview is a live service. */
(()=>{
"use strict";
const dashboard=document.getElementById("account");
if(!dashboard)return;
const target=dashboard.querySelector(".heading")||dashboard;
const section=document.createElement("section");
section.className="panel blorp-runtime-panel";
section.setAttribute("aria-label","BLORP backend and AI status");
section.innerHTML='<div class="panelhead"><div><h2>BLORP Connection Center</h2><p class="subtle">Live checks against this local backend. Demo-only pages are not runtime features.</p></div><button class="btn" type="button" id="blorpCheckRuntime">↻ Check connections</button></div><div class="blorp-runtime-grid" id="blorpRuntimeChecks"></div><p class="form-hint" id="blorpRuntimeNote" role="status" aria-live="polite">Checking the backend…</p><p class="form-hint">Google login requires your own OAuth Web client ID. Open <code>docs/AUTH_BILLING.md</code> in the repository for the setup steps. External API keys must be connected through the Electron Model Hub; the browser preview cannot access its secure vault.</p>';
target.insertAdjacentElement("afterend",section);
const slots=document.getElementById("blorpRuntimeChecks");
const note=document.getElementById("blorpRuntimeNote");
const indicators={backend:["Python server","Checking…"],ollama:["Local Ollama","Checking…"],google:["Google sign-in","Checking…"],models:["AI providers","Checking…"]};
const nodes={};
for(const [key,[label,status]] of Object.entries(indicators)){
 const item=document.createElement("div");item.className="blorp-runtime-item";
 const name=document.createElement("strong");name.textContent=label;
 const value=document.createElement("span");value.textContent=status;
 item.append(name,value);slots.append(item);nodes[key]=value;
}
const pill=document.querySelector(".top-right > .pill");
const tell=(key,value)=>{nodes[key].textContent=value;};
async function get(path){
 const response=await fetch(path,{credentials:"same-origin",cache:"no-store"});
 let body={};
 try{body=await response.json()}catch(_){throw Error("Invalid JSON response")}
 return {ok:response.ok,status:response.status,body};
}
async function check(){
 note.textContent="Checking runtime services…";
 try {
  const health=await get("/api/health");
  if(!health.ok||health.body.ok!==true)throw Error("Health endpoint unavailable");
  tell("backend","✓ Online · "+String(health.body.version||"local backend"));
  if(pill){pill.textContent="● Local backend online";pill.title="Python backend responded to /api/health";}
  note.textContent="Backend is running. Some older pages still contain sample metrics and preview controls.";
 }catch(e){
  tell("backend","✕ Offline or invalid response");
  tell("ollama","Not checked");tell("google","Not checked");tell("models","Not checked");
  if(pill){pill.textContent="● Backend unavailable";pill.title="Cannot reach the Python API";}
  note.textContent="Start BLORP using python server.py and open the printed http://127.0.0.1 address (not the HTML file directly).";
  return;
 }
 const results=await Promise.allSettled([get("/api/local/models"),get("/api/auth/config")]);
 const models=results[0];
 if(models.status==="fulfilled"){
  const m=models.value;
  if(m.ok&&m.body.connected){
   const count=Array.isArray(m.body.models)?m.body.models.length:0;
   tell("ollama",count?("✓ Connected · "+count+" model(s)"):"Online · no models installed");
  }else tell("ollama","✕ "+String(m.body.error||"Not connected").slice(0,110));
 }else tell("ollama","✕ Cannot check Ollama");
 const google=results[1];
 if(google.status==="fulfilled"&&google.value.ok){
  const enabled=Boolean(google.value.body.google_client_id||google.value.body.google_desktop_client_id);
  tell("google",enabled?"✓ OAuth client configured":"Setup needed · OAuth client ID missing");
 }else tell("google","Unable to read configuration");
 const native=!!(window.blorpStudio&&typeof window.blorpStudio.invoke==="function");
 if(native){
  try {
   const cat=await window.blorpStudio.invoke("catalog");
   const connected=Array.isArray(cat?.providers)?cat.providers.filter(p=>p.connected).length:0;
   tell("models","Desktop Model Hub · "+connected+" API provider(s)");
  }catch(_){tell("models","Desktop Model Hub unavailable");}
 }else tell("models","Browser mode · desktop API vault unavailable");
}
document.getElementById("blorpCheckRuntime").addEventListener("click",check);
check();
})();