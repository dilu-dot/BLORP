"use strict";
/**
 * Blorp Model Hub: one local default, per-task routing and per-user encrypted BYOK.
 * Customer secrets never leave Electron's main process except for a request sent to
 * the fixed, explicitly selected provider endpoint. No custom/untrusted API URLs.
 */
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const OLLAMA = "http://127.0.0.1:11434";
const DEFAULT_ALIAS = "blorp:latest";
const BASES = Object.freeze({
  balanced: { model: "qwen3.5:4b", label: "Blorp Balanced · Qwen3.5 4B", size: "~3.4 GB", license: "Apache-2.0" },
  light: { model: "qwen2.5-coder:1.5b", label: "Blorp Lite · Qwen2.5 Coder 1.5B", size: "~986 MB", license: "Apache-2.0" }
});
const TASKS = Object.freeze(["chat", "architect", "landing", "frontend", "threejs", "animations", "qa"]);
const PROVIDERS = Object.freeze({
  openai: { label: "OpenAI", kind: "openai", url: "https://api.openai.com/v1/chat/completions" },
  openrouter: { label: "OpenRouter", kind: "openai", url: "https://openrouter.ai/api/v1/chat/completions" },
  groq: { label: "Groq", kind: "openai", url: "https://api.groq.com/openai/v1/chat/completions" },
  mistral: { label: "Mistral", kind: "openai", url: "https://api.mistral.ai/v1/chat/completions" },
  nvidia: { label: "NVIDIA NIM", kind: "openai", url: "https://integrate.api.nvidia.com/v1/chat/completions" },
  gemini: { label: "Google Gemini", kind: "gemini", url: "https://generativelanguage.googleapis.com/v1beta/models/" },
  anthropic: { label: "Anthropic Claude", kind: "anthropic", url: "https://api.anthropic.com/v1/messages" }
});
const MODEL_NAME = /^[a-zA-Z0-9._:/+\-]{1,140}$/;
function uuid(v) { if (typeof v !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(v)) throw Error("Invalid account ID"); return v }
function isTask(v) { if (!TASKS.includes(v)) throw Error("Unsupported model task"); return v }
function isProvider(v) { if (!Object.prototype.hasOwnProperty.call(PROVIDERS,v)) throw Error("Unsupported API provider"); return v }
function validModel(v) { if (typeof v !== "string" || !MODEL_NAME.test(v)) throw Error("Invalid model identifier"); return v }
function initialRoutes() {
  return Object.fromEntries(TASKS.map(task=>[task,{kind:"local",model:DEFAULT_ALIAS}]));
}
function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file,"utf8")) }
  catch(e) { if (e.code==="ENOENT") return null; throw Error("Cannot read model settings") }
}
function atomicWrite(file,data) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+"."+crypto.randomUUID()+".tmp";
  try { fs.writeFileSync(tmp,data,{mode:0o600}); fs.renameSync(tmp,file) }
  finally { try { if(fs.existsSync(tmp))fs.unlinkSync(tmp) } catch {} }
}
async function requestOllama(route,body=null,timeout=220000) {
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),timeout);
  try {
    const response=await fetch(OLLAMA+route,{method:body?"POST":"GET",redirect:"error",signal:abort.signal,
      headers:body?{"content-type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
    if(!response.ok)throw Error("Ollama HTTP "+response.status);
    const raw=await response.text();
    if(raw.length>950000)throw Error("Ollama returned an oversized response");
    return JSON.parse(raw);
  }catch(e) {
    if(e.name==="AbortError")throw Error("Ollama request timed out");
    if(e.message?.includes("fetch failed"))throw Error("Ollama is not running on this PC. Install and start Ollama first.");
    throw e;
  }finally{clearTimeout(timer)}
}
function safeMessages(input) {
  if(!Array.isArray(input)||input.length<1||input.length>24)throw Error("Invalid AI messages");
  let size=0;
  return input.map(msg=>{
    if(!msg||!["system","user","assistant"].includes(msg.role)||typeof msg.content!=="string"||!msg.content.trim())
      throw Error("Invalid AI message");
    size+=msg.content.length;
    if(size>45000)throw Error("AI prompt is too large");
    return {role:msg.role,content:msg.content};
  });
}
async function providerInference(provider,apiKey,model,body) {
  const cfg=PROVIDERS[isProvider(provider)],messages=safeMessages(body.messages);
  const tokens=Number.isInteger(body.options?.num_predict)?Math.min(Math.max(body.options.num_predict,64),7600):1300;
  const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),110000);
  let endpoint=cfg.url,headers={"content-type":"application/json"},data;
  try {
    if(cfg.kind==="openai") {
      headers.authorization="Bearer "+apiKey;
      data={model,messages,stream:false,max_tokens:tokens};
      if(provider==="openrouter") {headers["HTTP-Referer"]="https://github.com/dilu-dot/BLORP";headers["X-Title"]="Blorp AI"}
    } else if(cfg.kind==="gemini") {
      if(!/^[a-zA-Z0-9._-]{1,120}$/.test(model))throw Error("Invalid Gemini model name");
      endpoint+=model+":generateContent";
      headers["x-goog-api-key"]=apiKey;
      data={contents:messages.filter(m=>m.role!=="system").map(m=>({
        role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]
      })),generationConfig:{maxOutputTokens:tokens}};
      const system=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n");
      if(system)data.systemInstruction={parts:[{text:system}]};
    } else {
      headers["x-api-key"]=apiKey;
      headers["anthropic-version"]="2023-06-01";
      data={model,max_tokens:tokens,messages:messages.filter(x=>x.role!=="system")};
      const system=messages.filter(x=>x.role==="system").map(x=>x.content).join("\n");
      if(system)data.system=system;
    }
    const response=await fetch(endpoint,{method:"POST",redirect:"error",signal:abort.signal,
      headers,body:JSON.stringify(data)});
    // Never repeat provider error bodies; they may contain request details.
    if(!response.ok)throw Error(cfg.label+" request failed (HTTP "+response.status+"). Check key, model name, quota and billing.");
    const raw=await response.text();
    if(raw.length>900000)throw Error("Provider response was too large");
    const result=JSON.parse(raw);
    let answer;
    if(cfg.kind==="openai")answer=result?.choices?.[0]?.message?.content;
    else if(cfg.kind==="gemini")answer=result?.candidates?.[0]?.content?.parts?.map(p=>p.text||"").join("");
    else answer=result?.content?.filter(x=>x.type==="text").map(x=>x.text).join("\n");
    if(typeof answer!=="string"||!answer.trim())throw Error(cfg.label+" returned no text. Verify this model supports text chat.");
    return {model,message:{role:"assistant",content:answer},provider};
  }catch(e){
    if(e.name==="AbortError")throw Error(cfg.label+" timed out");
    if(e.message?.includes("fetch failed"))throw Error("Unable to connect to "+cfg.label+". Check your internet connection.");
    throw e;
  }finally{clearTimeout(timer)}
}
class ModelHub {
  constructor({dataDir,cloud,safeStorage}) {
    this.dataDir=path.join(dataDir,"BlorpModelHub");this.cloud=cloud;this.safeStorage=safeStorage;this.installing=false;
  }
  async userId(){
    const {data,error}=await this.cloud.client.auth.getUser();
    if(error||!data.user||data.user.is_anonymous)throw Error("Sign in to configure your AI models");
    return uuid(data.user.id);
  }
  async routes(){
    const key=await this.userId(),file=path.join(this.dataDir,key+".json");
    const saved=readJson(file);
    const routes=initialRoutes();
    for(const task of TASKS) {
      const s=saved?.routes?.[task];
      if(!s||!["local","provider"].includes(s.kind))continue;
      try {
        if(s.kind==="local")routes[task]={kind:"local",model:validModel(s.model)};
        else routes[task]={kind:"provider",provider:isProvider(s.provider),model:validModel(s.model)};
      }catch{}
    }
    return routes;
  }
  async setRoute({task,kind,model,provider}){
    isTask(task);
    if(kind!=="local"&&kind!=="provider")throw Error("Select a local or API model");
    validModel(model);
    const next=await this.routes();
    next[task]=kind==="local"?{kind,model}:{kind,provider:isProvider(provider),model};
    const key=await this.userId();
    atomicWrite(path.join(this.dataDir,key+".json"),JSON.stringify({routes:next},null,2));
    return {routes:next};
  }
  vaultFile(key){return path.join(this.dataDir,"keys-"+uuid(key)+".enc")}
  async readKeys(){
    if(!this.safeStorage?.isEncryptionAvailable())throw Error("Secure OS key storage is unavailable. API keys cannot be saved.");
    const file=this.vaultFile(await this.userId());
    if(!fs.existsSync(file))return {};
    let value;
    try { value=JSON.parse(this.safeStorage.decryptString(fs.readFileSync(file))) }
    catch { throw Error("Encrypted API credentials could not be unlocked on this device") }
    if(!value||typeof value!=="object"||Array.isArray(value))throw Error("Invalid credential vault");
    return value;
  }
  async connectProvider({provider,key}){
    isProvider(provider);
    if(typeof key!=="string"||key.length<8||key.length>450||/\s/.test(key))throw Error("Enter a valid API key");
    const current=await this.readKeys();
    current[provider]=key;
    atomicWrite(this.vaultFile(await this.userId()),this.safeStorage.encryptString(JSON.stringify(current)));
    return {provider,connected:true};
  }
  async disconnectProvider({provider}){
    isProvider(provider);
    const current=await this.readKeys();
    delete current[provider];
    atomicWrite(this.vaultFile(await this.userId()),this.safeStorage.encryptString(JSON.stringify(current)));
    return {provider,connected:false};
  }
  async catalog(){
    const routes=await this.routes();
    let keys={},vaultError=null;
    try{keys=await this.readKeys()}catch(e){vaultError=e.message}
    let ollama;
    try{const data=await requestOllama("/api/tags",null,4000);
      ollama={connected:true,models:(data.models||[]).map(x=>String(x.name||"")).filter(Boolean).slice(0,150)};
    }catch(e){ollama={connected:false,models:[],error:e.message}}
    return {routes,providers:Object.entries(PROVIDERS).map(([id,v])=>({id,label:v.label,connected:Boolean(keys[id])})),
      tasks:TASKS,defaultModel:DEFAULT_ALIAS,bases:BASES,ollama,secureStorage:Boolean(this.safeStorage?.isEncryptionAvailable()),vaultError};
  }
  async installDefault({base},onProgress=()=>{}){
    if(this.installing)throw Error("Blorp installation is already running");
    if(!Object.prototype.hasOwnProperty.call(BASES,base))throw Error("Choose Balanced or Lite");
    const available=await this.catalog();
    if(!available.ollama.connected)throw Error("Install and start Ollama first: https://ollama.com/download/windows");
    if(available.ollama.models.some(x=>x==="blorp"||x===DEFAULT_ALIAS))return {installed:true,alreadyPresent:true,model:DEFAULT_ALIAS};
    this.installing=true;
    try{
      const source=BASES[base].model;
      if(!available.ollama.models.includes(source)){
        onProgress({phase:"download",status:"Downloading "+source+" from Ollama (first-time setup)…"});
        const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),45*60*1000);
        try {
          const res=await fetch(OLLAMA+"/api/pull",{method:"POST",redirect:"error",signal:abort.signal,
            headers:{"content-type":"application/json"},body:JSON.stringify({model:source,stream:true,insecure:false})});
          if(!res.ok||!res.body)throw Error("Ollama could not download the selected base model (HTTP "+res.status+")");
          let buffer="",success=false;
          for await(const chunk of res.body) {
            buffer+=Buffer.from(chunk).toString("utf8");
            if(buffer.length>150000)throw Error("Unexpected Ollama download output");
            let index;
            while((index=buffer.indexOf("\n"))>=0){
              const line=buffer.slice(0,index).trim();buffer=buffer.slice(index+1);
              if(!line)continue;
              let data;try{data=JSON.parse(line)}catch{continue}
              if(data.error)throw Error("Ollama model download failed");
              if(data.status==="success")success=true;
              if(data.status)onProgress({phase:"download",status:String(data.status).slice(0,120),
                percent:Number.isFinite(data.completed)&&Number.isFinite(data.total)&&data.total>0?
                  Math.max(0,Math.min(100,Math.round(100*data.completed/data.total))):null});
            }
          }
          if(!success)throw Error("Ollama download did not complete");
        }finally{clearTimeout(timer)}
      }
      onProgress({phase:"create",status:"Creating your Blorp model alias…"});
      const result=await requestOllama("/api/create",{
        from:source,model:"blorp",
        system:"You are Blorp AI, a capable local-first assistant for programming, accessible frontend design, web animation, 3D architecture and software engineering. State limitations accurately. Give maintainable code, explain essential setup, and do not claim to have run code or tests.",
        parameters:{num_ctx:4096,temperature:0.35},stream:false
      },120000);
      if(result.status!=="success")throw Error("Ollama did not confirm Blorp model creation");
      onProgress({phase:"complete",status:"Blorp is installed and ready",percent:100});
      return {installed:true,model:DEFAULT_ALIAS,base:source};
    }finally{this.installing=false}
  }
  async infer(task,body){
    isTask(task);
    const route=(await this.routes())[task];
    if(!route)throw Error("Configure a model for "+task);
    const messages=safeMessages(body.messages);
    if(route.kind==="local"){
      const d=await requestOllama("/api/tags",null,5000);
      if(!(d.models||[]).some(x=>x.name===route.model || (route.model==="blorp:latest"&&x.name==="blorp")))
        throw Error("Model "+route.model+" is not installed. Open Model Hub to install Blorp or change this task's model.");
      return requestOllama("/api/chat",{...body,messages,model:route.model,stream:false});
    }
    const keys=await this.readKeys();
    if(!keys[route.provider])throw Error("No API key connected for "+PROVIDERS[route.provider].label+". Open Model Hub.");
    return providerInference(route.provider,keys[route.provider],route.model,{...body,messages});
  }
  async testProvider({provider,model}){
    isProvider(provider);validModel(model);
    const keys=await this.readKeys();
    if(!keys[provider])throw Error("Connect this provider first");
    const response=await providerInference(provider,keys[provider],model,{messages:[{role:"user",content:"Reply exactly: OK"}],options:{num_predict:40}});
    return {success:true,provider,model,preview:response.message.content.slice(0,80)};
  }
}
module.exports={ModelHub,DEFAULT_ALIAS,BASES,TASKS,PROVIDERS,providerInference};
