/* Blorp Model Hub. All keys are sent only to native Electron IPC, never stored in the page. */
(()=>{
"use strict";
if(!window.blorpStudio)return;
const bridge=window.blorpStudio,studio=document.getElementById("native");
if(!studio)return;
const nav=studio.querySelector(".studio-nav");
if(!nav)return;
const button=document.createElement("button");button.type="button";button.textContent="◈ Model Hub";button.id="blorpModelHubOpen";
nav.append(button);
const panel=document.createElement("div");panel.id="blorpModelHub";panel.hidden=true;
panel.innerHTML=
'<div class="hub-heading"><div><span class="hub-eyebrow">BLORP / AI ORCHESTRATION</span><h2>Model <em>Hub.</em></h2><p>Blorp is your default. Add provider APIs and route each job to the model you want.</p></div><button type="button" id="hubRefresh">↻ Refresh</button></div>'+
'<div class="hub-status" id="hubStatus" role="status" aria-live="polite">Open the Model Hub to load settings.</div>'+
'<section class="hub-card"><div class="hub-card-title"><div><h3>✦ Install default Blorp AI</h3><p>A real local model, customized with a Blorp system prompt. Installed on your PC, not bundled into GitHub.</p></div><span class="hub-chip">LOCAL-FIRST</span></div><div class="hub-inline"><label>Choose model size<select id="hubBase"><option value="balanced">Blorp Balanced · 4B (~3.4 GB)</option><option value="light">Blorp Lite · 1.5B (~986 MB)</option></select></label><button id="hubInstall" type="button" class="hub-primary">Install Blorp</button></div><div id="hubInstallProgress" class="hub-help">Requires Ollama installed and running. Download starts only when you click Install.</div><div id="hubLocalModels" class="hub-model-list"></div></section>'+
'<section class="hub-card"><div class="hub-card-title"><div><h3>🔑 Connect multiple API providers</h3><p>Your API keys are encrypted using your OS key store. They are not uploaded to BLORP or written to the repo.</p></div><span class="hub-chip">BYOK</span></div><form id="hubProviderForm" class="hub-key-form"><label>Provider<select id="hubProviderSelect"></select></label><label>API key<input id="hubApiKey" type="password" autocomplete="off" maxlength="450" placeholder="Paste your provider API key" required /></label><button type="submit" class="hub-primary" id="hubConnect">Connect securely</button></form><div class="hub-providers" id="hubProviderList"></div><p class="hub-help">Connected providers can charge your account for usage. Set spending limits in each provider dashboard. Chat/build prompts leave your computer when routed to external APIs.</p></section>'+
'<section class="hub-card"><div class="hub-card-title"><div><h3>⌘ Model assignment by task</h3><p>Use different models for architecture, landing pages, frontend code, Three.js tasks, animations and QA.</p></div><span class="hub-chip">SMART ROUTING</span></div><div class="hub-roles" id="hubRoutes"></div><p class="hub-help">Task routing chooses a model for the existing generator. Three.js runtime packages and autonomous code execution are not bundled yet.</p></section>';
studio.append(panel);
const $=id=>document.getElementById(id);
let catalog=null,installing=false;
const pretty={chat:"Chat Assistant",architect:"Architect / Planning",landing:"Landing Page Builder",
 frontend:"Frontend Developer",threejs:"Three.js Specialist",animations:"Animations / Motion",qa:"QA & Review"};
function message(m,err=false){$("hubStatus").textContent=m;$("hubStatus").classList.toggle("error",err)}
async function call(action,payload){
 try{return await bridge.invoke(action,payload)}
 catch(e){throw Error(String(e?.message||e).replace(/^Error invoking remote method '[^']+': Error:\s*/,""))}
}
function option(value,label){const o=document.createElement("option");o.value=value;o.textContent=label;return o}
function roleControl(task,route){
 const el=document.createElement("form");el.className="hub-role";el.dataset.task=task;
 const top=document.createElement("div");top.className="hub-role-top";
 const name=document.createElement("strong");name.textContent=pretty[task]||task;
 const status=document.createElement("small");status.textContent=route.kind==="local"?"On-device inference":"Connected API";
 top.append(name,status);el.append(top);
 const controls=document.createElement("div");controls.className="hub-role-controls";
 const kind=document.createElement("select");kind.name="kind";kind.setAttribute("aria-label",pretty[task]+" route type");
 kind.add(option("local","Ollama (local)"),option("provider","External API"));kind.value=route.kind;
 const provider=document.createElement("select");provider.name="provider";provider.setAttribute("aria-label",pretty[task]+" API provider");
 for(const p of catalog.providers)provider.add(option(p.id,p.label+(p.connected?" ✓":" · key missing")));
 if(route.provider)provider.value=route.provider;
 const model=document.createElement("input");model.name="model";model.maxLength=140;model.required=true;
 model.placeholder=route.kind==="local"?"blorp:latest":"Enter exact provider model ID";
 model.value=route.model||"blorp:latest";model.setAttribute("aria-label",pretty[task]+" model identifier");
 const listId="hub-models-"+task;
 const datalist=document.createElement("datalist");datalist.id=listId;
 for(const m of [catalog.defaultModel,...catalog.ollama.models])datalist.append(option(m,m));
 model.setAttribute("list",listId);
 const save=document.createElement("button");save.type="submit";save.textContent="Save";
 function redraw(){
  const useProvider=kind.value==="provider";
  provider.hidden=!useProvider;
  top.lastChild.textContent=useProvider?"Your API key · provider billed":"Ollama · stored locally";
  model.placeholder=useProvider?"Enter exact provider model ID":"blorp:latest";
  if(useProvider&&model.value==="blorp:latest")model.value="";
  if(!useProvider&&!model.value)model.value="blorp:latest";
 }
 kind.addEventListener("change",redraw);
 controls.append(kind,provider,model,save,datalist);el.append(controls);redraw();
 el.addEventListener("submit",async e=>{
  e.preventDefault();save.disabled=true;
  try{
   const result=await call("setRoute",{task,kind:kind.value,
     ...(kind.value==="provider"?{provider:provider.value}:{}),model:model.value.trim()});
   catalog.routes=result.routes;message("Model route saved for "+pretty[task]+".");
  }catch(err){message(err.message,true)}finally{save.disabled=false}
 });
 return el;
}
function paint(){
 const c=catalog;if(!c)return;
 const ollama=c.ollama;
 $("hubLocalModels").replaceChildren();
 const installed=(ollama.models||[]).map(m=>{const span=document.createElement("span");span.className="hub-model-pill";span.textContent=m;return span});
 const state=document.createElement("p");state.className="hub-help";
 state.textContent=ollama.connected
  ?(ollama.models.includes(c.defaultModel)||ollama.models.includes("blorp")
     ?"✓ Blorp default installed and ready on this PC.":"Ollama detected. Blorp model is not installed yet.")
  :"Ollama is offline. Install/start Ollama to enable local inference.";
 $("hubLocalModels").append(state,...installed);
 const selectors=[$("hubProviderSelect")];selectors.forEach(s=>s.replaceChildren(...c.providers.map(p=>option(p.id,p.label))));
 $("hubProviderList").replaceChildren(...c.providers.map(p=>{
  const card=document.createElement("div");card.className="hub-provider";
  const title=document.createElement("span");title.textContent=p.label;
  const tag=document.createElement("small");tag.textContent=p.connected?"● Connected":"Not connected";
  if(p.connected)tag.className="connected";
  card.append(title,tag);
  if(p.connected){
   const del=document.createElement("button");del.type="button";del.textContent="Remove";
   del.addEventListener("click",async()=>{
    if(!confirm("Remove saved API credentials for "+p.label+"? Model routing will remain configured but API calls will fail until reconnected."))return;
    try{await call("disconnectProvider",{provider:p.id});message(p.label+" key removed.");await refresh()}
    catch(err){message(err.message,true)}
   });card.append(del);
  }
  return card;
 }));
 $("hubRoutes").replaceChildren(...c.tasks.map(task=>roleControl(task,c.routes[task])));
 $("hubConnect").disabled=!c.secureStorage;
 if(!c.secureStorage)message(c.vaultError||"OS encryption unavailable; connecting provider keys is disabled.",true);
}
async function refresh(){
 catalog=await call("catalog");paint();
 if(catalog.secureStorage)message("Model configuration loaded. Saved routes are local to this Windows user.");
}
function open(){
 for(const id of ["studioChatPage","studioBuildPage","studioProjectsPage"])$(id).hidden=true;
 panel.hidden=false;
 nav.querySelectorAll("button").forEach(el=>el.classList.toggle("selected",el===button));
 refresh().catch(e=>message(e.message,true));
}
button.addEventListener("click",open);
nav.querySelectorAll("[data-studio-page]").forEach(x=>x.addEventListener("click",()=>{panel.hidden=true;button.classList.remove("selected")}));
$("hubRefresh").addEventListener("click",()=>refresh().catch(e=>message(e.message,true)));
$("hubInstall").addEventListener("click",async()=>{
 if(installing)return;
 if(!confirm("Download the selected Ollama model to this computer? This requires disk space and internet access for the first setup."))return;
 installing=true;$("hubInstall").disabled=true;
 try{
  message("Installing local Blorp model…");
  const result=await call("installBlorp",{base:$("hubBase").value});
  if(result.installed){message(result.alreadyPresent?"Blorp is already installed.":"Blorp installed successfully. Ready for chat and agent routing.");await refresh();$("studioDetect")?.click();}
 }catch(e){message(e.message,true)}finally{installing=false;$("hubInstall").disabled=false}
});
bridge.onInstallProgress?.(progress=>{
 if(!progress||typeof progress!=="object")return;
 const pct=Number.isFinite(progress.percent)?" · "+progress.percent+"%":"";
 $("hubInstallProgress").textContent=String(progress.status||"Installing").slice(0,130)+pct;
});
$("hubProviderForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const key=$("hubApiKey").value.trim(),provider=$("hubProviderSelect").value;
 if(!key)return message("Enter an API key first.",true);
 $("hubConnect").disabled=true;
 try{await call("connectProvider",{provider,key});message("Encrypted API key saved for "+provider+".");
   await refresh();}
 catch(err){message(err.message,true)}
 finally{$("hubApiKey").value="";$("hubConnect").disabled=false}
});
const focus=document.createElement("label");focus.textContent="Model task specialization";
const pick=document.createElement("select");pick.id="studioTaskFocus";
for(const [id,label] of [["landing","Landing page"],["frontend","Frontend coding"],["threejs","Three.js / 3D planning"],["animations","Motion / animation"]])pick.add(option(id,label));
focus.append(pick);
const brief=$("studioBrief")?.closest("label");
if(brief)brief.parentNode.insertBefore(focus,brief);
const launchButton=$("studioDetect");
if(launchButton)launchButton.title="Detect local models and enabled premium cloud chat. Use Model Hub to install Blorp and route models.";
window.addEventListener("blorp:authchange",e=>{if(!e.detail){catalog=null;panel.hidden=true}else if(!panel.hidden){refresh().catch(err=>message(err.message,true))}});
})();
