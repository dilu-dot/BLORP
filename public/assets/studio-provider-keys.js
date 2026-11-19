/* BLORP Studio Phase 3.1 — Windows DPAPI provider-key bridge.
 * Real keys are submitted only to the authenticated localhost Python server.
 * Never put secrets in localStorage, state.credentials, HTML exports or logs.
 */
(()=>{
"use strict";
const backend=window.BlorpBackend,app=window.BlorpApp;
if(!backend?.enabled||!app)return;
const $=id=>document.getElementById(id);
const PROVIDER_MAP=Object.freeze({
  "Google AI Studio":"gemini","OpenAI":"openai","Anthropic":"anthropic",
  "OpenRouter":"openrouter","Groq":"groq","Mistral":"mistral","NVIDIA":"nvidia"
});
const LABELS=Object.fromEntries(Object.entries(PROVIDER_MAP).map(([name,id])=>[id,name]));
let accountId=null,storageAvailable=false,backendProviders=[],loading=false;
let updateGeneration=0,busy=false,modelChecks={},checking=new Set();
const notice=$("keyDialog").querySelector("#keyModalDescription");
const keyField=$("keyPreviewSecret");

async function call(path,payload){
  const response=await fetch(path,{method:payload===undefined?"GET":"POST",
    headers:{...(payload===undefined?{}:{"Content-Type":"application/json"}),
             ...(currentUser()?{"X-Blorp-Account":currentUser().id}:{})},
    credentials:"same-origin",cache:"no-store",
    body:payload===undefined?undefined:JSON.stringify(payload)});
  let data;
  try{data=await response.json()}catch{throw Error("Provider-key backend returned invalid JSON")}
  if(!response.ok)throw Error(data?.error||"Provider-key request failed");
  return data;
}
function currentUser(){return backend.getUser?.()||null}
function providerMode(){
  return $("keyDialog").querySelector("[data-key-modal-tab].selected")?.dataset.keyModalTab==="provider";
}
function resetSecret(){
  keyField.value="";
  keyField.type="password";
  keyField.autocomplete="off";
}
function refreshKeyDialog(){
  const loggedIn=!!currentUser();
  const mode=providerMode();
  const ready=loggedIn&&storageAvailable&&mode;
  keyField.disabled=!ready;
  keyField.required=ready;
  keyField.placeholder=storageAvailable?"Paste your provider API key":"Windows encrypted storage unavailable";
  $("keyModalSubmit").disabled=!ready||busy;
  $("keyModalSubmit").textContent=ready?"Save securely":"Unavailable";
  notice.textContent=!loggedIn
    ?"Sign in before saving a provider API key."
    :!storageAvailable
      ?"Provider keys require the Windows desktop/local server with DPAPI. No plaintext fallback is allowed."
      :mode
        ?"Encrypted for this Windows account · never shown again · connection not yet verified."
        :"Only supported provider-key connections are available in this phase; import and custom endpoints stay disabled.";
}
function setStatus(message){
  app.notify(message);
}
function refreshProfileMetadata(){
  const count=backendProviders.length;
  $("profileKeyHealth").textContent=count?Object.values(modelChecks).filter(x=>x.status==="catalog_checked").length+" authenticated catalogs · "+count+" saved keys":"No provider keys saved";
  $("profileProviderCount").textContent=count+" saved provider"+(count===1?"":"s")+" · inference untested";
}
function renderConnected(){
  const user=currentUser();
  if(!user||user.id!==accountId)return;
  const s=app.getState();
  s.credentials=backendProviders.map(item=>({
    id:"secured-"+item.provider,
    provider: LABELS[item.provider]||item.name||item.provider,
    alias:item.label||item.name||item.provider,
    enabled:true, models:(modelChecks[item.provider]?.models||[]).map(m=>({id:m.id,enabled:modelChecks[item.provider]?.status==="catalog_checked"})),catalogStatus:modelChecks[item.provider]?.status||'not_checked', backendStored:true, providerId:item.provider,
    createdAt:new Date((item.stored_at||0)*1000).toISOString()
  }));
  app.commit();app.rerender();
  const count=backendProviders.length;
  $("keyConfiguredCount").textContent=count+" provider key"+(count===1?"":"s")+" securely saved · not verified";
  $("keyStats").textContent=count+" saved · "+Object.values(modelChecks).filter(x=>x.status==="catalog_checked").length+" authenticated catalogs";
  refreshProfileMetadata();
  const warning=document.querySelector("#keys .key-warning");
  if(warning)warning.textContent=storageAvailable
    ?"🔒 Keys are protected with Windows DPAPI. Verify & Discover retrieves real catalogs but listing does not prove model inference access or billing."
    :"🔒 Secure credential storage is unavailable here. Real API keys cannot be saved; use a Windows localhost installation.";
  annotateDiscovery();refreshKeyDialog();
}

function annotateDiscovery(){
  const statuses={catalog_checked:"Authenticated catalog · inference untested",catalog_only:"Public catalog · key unverified",invalid:"Key rejected",restricted:"Access restricted",rate_limited:"Rate limited",unavailable:"Provider unavailable"};
  document.querySelectorAll("#keys [data-remove-key]").forEach(remove=>{
    const item=backendProviders.find(p=>"secured-"+p.provider===remove.dataset.removeKey);
    if(!item)return;
    const row=remove.closest(".keys-provider-card"),actions=remove.closest(".row-actions");
    if(!row||!actions)return;
    let btn=actions.querySelector("[data-discover-provider]");
    if(!btn){
      btn=document.createElement("button");
      btn.className="btn small";btn.type="button";btn.dataset.discoverProvider=item.provider;
      actions.prepend(btn);
    }
    btn.disabled=checking.has(item.provider);
    btn.textContent=checking.has(item.provider)?"Checking…":"↻ Verify & Discover";
    let status=row.querySelector(".blorp-discovery-status");
    if(!status){
      status=document.createElement("div");status.className="small-help blorp-discovery-status";
      status.style.cssText="padding:8px 14px;border-top:1px solid rgba(127,179,184,.16)";
      row.append(status);
    }
    const check=modelChecks[item.provider];
    status.textContent=check?(statuses[check.status]||"Not verified")+
      (["catalog_checked","catalog_only"].includes(check.status)?" · "+check.model_count+" models":"")+
      (check.truncated?" · catalog capped":""):"Not checked · saved key";
  });
}
async function discoverProvider(provider){
  if(!currentUser()||checking.has(provider)||!(provider in LABELS))return;
  const id=currentUser().id;
  checking.add(provider);annotateDiscovery();
  try{
    await call("/api/provider-models/discover",{provider});
    if(currentUser()?.id===id){await loadProviders();setStatus(LABELS[provider]+": catalog checked; inference not tested");}
  }catch(error){
    if(currentUser()?.id===id){await loadProviders();setStatus(LABELS[provider]+": "+error.message);}
  }finally{checking.delete(provider);if(currentUser()?.id===id)annotateDiscovery();}
}

async function loadProviders(){
  const user=currentUser();
  if(!user){accountId=null;backendProviders=[];storageAvailable=false;return;}
  if(loading)return;
  loading=true;
  const requestedUser=user.id,cycle=++updateGeneration;
  try{
    const result=await call("/api/provider-keys");
    if(cycle!==updateGeneration||currentUser()?.id!==requestedUser)return;
    storageAvailable=!!result.storage_available;
    backendProviders=Array.isArray(result.providers)?result.providers.filter(p=>p?.provider in LABELS):[];
    try{
      const checks=await call("/api/provider-models");
      if(currentUser()?.id===requestedUser)modelChecks=Object.fromEntries(
        (checks.checks||[]).filter(x=>x&&x.provider in LABELS&&Array.isArray(x.models))
          .map(x=>[x.provider,x]));
    }catch(_){modelChecks={};}
    renderConnected();
  }catch(e){
    if(currentUser()?.id!==requestedUser)return;
    backendProviders=[];storageAvailable=false;renderConnected();setStatus(e.message);
  }finally{loading=false;}
}
function accountChanged(){
  const user=currentUser(),id=user?.id||null;
  if(id===accountId)return;
  accountId=id;
  backendProviders=[];storageAvailable=false;modelChecks={};checking.clear();updateGeneration++;
  const s=app.getState();
  if(s.credentials.length){s.credentials=[];app.commit();app.rerender();}
  refreshKeyDialog();
  if(id)loadProviders();
}
function nextFrame(action){setTimeout(action,0);}
document.addEventListener("blorp:state",accountChanged);
document.addEventListener("blorp:view",event=>{
  if(event.detail?.id==="keys"||event.detail?.id==="hub")nextFrame(()=>{
    if(accountId)loadProviders();
    refreshKeyDialog();
  });
});
document.addEventListener("click",event=>{
  const button=event.target.closest("button");
  if(!button)return;
  if(button.id==="openKeyDialog"&&!currentUser()){
    event.preventDefault();event.stopPropagation();backend.openAuth("signin");
  }else if(button.id==="openKeyDialog"){
    nextFrame(()=>{resetSecret();refreshKeyDialog()});
  }else if(button.hasAttribute("data-key-modal-tab")){
    nextFrame(refreshKeyDialog);
  }else if(button.id==="profileTrigger"){
    nextFrame(refreshProfileMetadata);
  }else if(button.hasAttribute("data-discover-provider")){
    event.preventDefault();event.stopPropagation();discoverProvider(button.dataset.discoverProvider);
  }else if(button.id==="checkKeysBtn"){
    event.preventDefault();event.stopPropagation();
    const control=$("checkKeysBtn");
    if(control.disabled)return;
    control.disabled=true;control.textContent="Checking providers…";
    (async()=>{
      try{
        const providers=backendProviders.map(p=>p.provider);
        if(!providers.length){setStatus("Add an API key first");return}
        for(const provider of providers)await discoverProvider(provider);
        setStatus("Catalog checks finished · inference remains untested");
      }finally{control.disabled=false;control.textContent="✓ Check all";}
    })();
  }else if(button.hasAttribute("data-remove-key")){
    const item=backendProviders.find(p=>"secured-"+p.provider===button.dataset.removeKey);
    if(!item)return;
    event.preventDefault();event.stopPropagation();
    if(!confirm("Remove the encrypted key for "+item.name+" from this Windows account?"))return;
    (async()=>{
      try{
        await call("/api/provider-keys/remove",{provider:item.provider});
        delete modelChecks[item.provider];await loadProviders();setStatus(item.name+" encrypted key removed");
      }catch(e){setStatus(e.message)}
    })();
  }
},true);
document.addEventListener("submit",event=>{
  if(event.target!==$("keyForm"))return;
  event.preventDefault();event.stopPropagation();
  if(busy)return;
  if(!currentUser())return backend.openAuth("signin");
  if(!storageAvailable||!providerMode())return setStatus("Secure Windows credential storage is required");
  const provider=PROVIDER_MAP[$("keyProvider").value];
  if(!provider)return setStatus("Choose one of the supported API providers");
  let secret=keyField.value;
  const label=$("keyAlias").value.trim();
  resetSecret();
  if(secret.length<8||secret.length>450||/\s/.test(secret)){
    secret="";return setStatus("Enter a valid 8–450 character API key");
  }
  busy=true;refreshKeyDialog();
  (async()=>{
    try{
      await call("/api/provider-keys",{provider,key:secret,label});
      $("keyDialog").close();
      delete modelChecks[provider];await loadProviders();
      setStatus((LABELS[provider]||provider)+" key encrypted and saved · click Verify & Discover");
    }catch(e){setStatus(e.message)}
    finally{secret="";busy=false;resetSecret();refreshKeyDialog()}
  })();
},true);
for(const option of $("keyProvider").options){
  if(option.value&&!Object.prototype.hasOwnProperty.call(PROVIDER_MAP,option.value))option.disabled=true;
}
for(const tab of document.querySelectorAll('#keyDialog [data-key-modal-tab]')){
  if(tab.dataset.keyModalTab!=="provider"){
    tab.title="Only secure provider keys are connected in this phase";
    tab.disabled=true;
  }
}
resetSecret();refreshKeyDialog();accountChanged();
window.BlorpProviderKeys=Object.freeze({
  refresh:loadProviders,
  status:()=>({saved:backendProviders.length,storageAvailable,checks:Object.keys(modelChecks).length}),
  discover:discoverProvider,
  catalogs:()=>JSON.parse(JSON.stringify(modelChecks))
});
})();