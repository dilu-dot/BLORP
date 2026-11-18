/* BLORP Phase 1: Multi Task-only model assignments. No agent execution. */
(() => {
  "use strict";
  const root = document.getElementById("multitask");
  if (!root) return;
  const STORAGE = "blorp-multitask-routes-v1";
  const $ = (id) => document.getElementById(id);
  const defaults = {kind:"local",provider:"",model:"blorp:latest"};
  let saved = {};
  let catalog = null;
  let online = false;
  try {
    const parsed=JSON.parse(localStorage.getItem(STORAGE)||"{}");
    if(parsed&&typeof parsed==="object"&&!Array.isArray(parsed))saved=parsed;
  } catch (_) { /* corrupt browser preferences should not block Multi Task */ }
  const panel=document.createElement("section");
  panel.className="panel mt-router";
  panel.setAttribute("aria-label","Multi Task model router");
  panel.innerHTML='<div class="panelhead"><div><h2>◈ Specialist Model Router</h2><p class="subtle">Assign one model per Multi Task agent. These preferences do not change Chat, Build Playground or Local AI Lab.</p></div><button class="btn" type="button" id="mtRefreshModels">↻ Refresh models</button></div><p class="mt-router-status" id="mtRouteStatus" role="status" aria-live="polite">Loading available models…</p><div id="mtRouteRows" class="mt-router-rows"></div><p class="form-hint">Configuration only. No agents are started and no API keys are stored here. Connect providers securely through the desktop Model Hub. Localhost browser mode can save draft assignments but cannot access desktop API credentials.</p>';
  const grid=$("agentGrid");
  if(grid)grid.parentElement.insertBefore(panel,grid);
  function agents(){
    try {return Array.isArray(blorpAgents)?blorpAgents:[]} catch (_) {return []}
  }
  function availableProviders(){
    return catalog&&Array.isArray(catalog.providers)?catalog.providers.filter(p=>p.connected):[];
  }
  function localModels(){
    const found=catalog&&catalog.ollama&&Array.isArray(catalog.ollama.models)?catalog.ollama.models:[];
    return Array.from(new Set(["blorp:latest",...found]));
  }
  function option(value,label){
    const item=document.createElement("option");
    item.value=value;item.textContent=label;return item;
  }
  function textStatus(message,error){
    $("mtRouteStatus").textContent=message;
    $("mtRouteStatus").classList.toggle("mt-error",!!error);
  }
  function read(agent){
    const item=saved[agent.id];
    if(!item||typeof item!=="object")return {...defaults};
    return {
      kind:item.kind==="provider"?"provider":"local",
      provider:typeof item.provider==="string"?item.provider:"",
      model:typeof item.model==="string"?item.model:"blorp:latest"
    };
  }
  function render(){
    const host=$("mtRouteRows");host.replaceChildren();
    for(const agent of agents()){
      const route=read(agent);
      const row=document.createElement("form");row.className="mt-route-row";
      const label=document.createElement("div");label.className="mt-route-agent";
      const name=document.createElement("strong");name.textContent=agent.name;
      const role=document.createElement("small");role.textContent=agent.role;
      label.append(name,role);
      const kind=document.createElement("select");
      kind.setAttribute("aria-label",agent.name+" model source");
      kind.add(option("local","Ollama (local)"),option("provider","Connected API"));
      kind.value=route.kind;
      const provider=document.createElement("select");
      provider.setAttribute("aria-label",agent.name+" API provider");
      for(const p of availableProviders())provider.add(option(p.id,p.label));
      if(route.provider)provider.value=route.provider;
      const model=document.createElement("input");
      model.type="text";model.maxLength=140;model.required=true;
      model.setAttribute("aria-label",agent.name+" model ID");
      model.setAttribute("list","mt-local-models");
      model.value=route.model;model.placeholder="Exact model ID";
      const save=document.createElement("button");save.type="submit";save.className="btn primary";save.textContent="Save";
      const update=()=>{
        provider.hidden=kind.value!=="provider";
        provider.disabled=kind.value!=="provider"||!online||!availableProviders().length;
        model.setAttribute("list",kind.value==="local"?"mt-local-models":"");
        if(kind.value==="provider"&&model.value==="blorp:latest")model.value="";
        if(kind.value==="local"&&!model.value)model.value="blorp:latest";
      };
      kind.addEventListener("change",update);update();
      row.append(label,kind,provider,model,save);
      row.addEventListener("submit",e=>{
        e.preventDefault();
        const modelId=model.value.trim();
        if(!modelId||modelId.length>140)return textStatus("Enter a valid model identifier.",true);
        if(kind.value==="provider"){
          if(!online)return textStatus("External API routing requires the BLORP desktop app.",true);
          if(!availableProviders().some(p=>p.id===provider.value))return textStatus("Connect this provider in Model Hub first.",true);
        }
        const selection={kind:kind.value,provider:kind.value==="provider"?provider.value:"",model:modelId};
        const next={...saved,[agent.id]:selection};
        try{localStorage.setItem(STORAGE,JSON.stringify(next));saved=next;
          textStatus("Saved model assignment for "+agent.name+". This does not execute the agent.",false);
        }catch(_){textStatus("Unable to save: browser storage is unavailable.",true)}
      });
      host.append(row);
    }
    if(!agents().length)host.textContent="Add a specialist agent to begin assigning models.";
  }
  const list=document.createElement("datalist");list.id="mt-local-models";panel.append(list);
  async function refresh(){
    online=!!(window.blorpStudio&&typeof window.blorpStudio.invoke==="function");
    if(online){
      try {
        catalog=await window.blorpStudio.invoke("catalog");
        if(!catalog||!Array.isArray(catalog.providers))throw Error("Invalid model catalog");
        textStatus("Desktop Model Hub connected. Select an installed Ollama model or connected API provider.",false);
      }catch(e){catalog=null;online=false;textStatus("Could not load desktop Model Hub: "+String(e.message||e),true)}
    } else {
      catalog=null;
      textStatus("Browser preview: local model IDs can be saved; connect APIs using BLORP desktop Model Hub.",false);
    }
    list.replaceChildren(...localModels().map(m=>option(m,m)));
    render();
  }
  $("mtRefreshModels").addEventListener("click",refresh);
  // Keep rows in sync when agents are added, edited or removed using existing controls.
  root.addEventListener("click",e=>{
    if(e.target.closest("[data-edit-agent],[data-remove-agent],#newAgentBtn,#addAgentTile")){
      setTimeout(render,120);
    }
  });
  $("agentForm")?.addEventListener("submit",()=>setTimeout(render,120));
  window.blorpMultiTaskModels={
    get:(agentId)=>({...read({id:String(agentId)})}),
    snapshot:()=>agents().map(agent=>({agentId:agent.id,name:agent.name,...read(agent)}))
  };
  refresh();
})();
