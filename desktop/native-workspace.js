"use strict";
// Blorp Local Workspace: stored under app.getPath("userData")/BlorpWorkspace/<auth user id>
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {runAgentBuild}=require("./local-agents");
const OLLAMA="http://127.0.0.1:11434", ALLOWED=["index.html","styles.css","script.js"];
function id(v){if(typeof v!=="string"||!/^[0-9a-f]{8}-[0-9a-f-]{27,40}$/i.test(v))throw Error("Invalid ID");return v}
function text(v,max){if(typeof v!=="string"||!v.trim()||v.length>max)throw Error("Invalid text (max "+max+" characters)");return v.trim()}
function read(file){try{return JSON.parse(fs.readFileSync(file,"utf8"))}catch(e){if(e.code==="ENOENT")return null;throw Error("Cannot read local workspace data")}}
function save(file,obj){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+".tmp";fs.writeFileSync(tmp,JSON.stringify(obj,null,2),"utf8");fs.renameSync(tmp,file)}
function list(dir){if(!fs.existsSync(dir))return [];return fs.readdirSync(dir).filter(x=>/^[0-9a-f-]{36}\.json$/i.test(x)).slice(0,300).map(x=>read(path.join(dir,x))).filter(Boolean)}
async function api(route,body,ms=210000){
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),ms);
 try{
   const r=await fetch(OLLAMA+route,{redirect:"error",method:body?"POST":"GET",signal:ctrl.signal,
     headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
   const str=await r.text();
   if(str.length>1000000)throw Error("Local model response too large");
   if(!r.ok)throw Error("Ollama HTTP "+r.status+" — confirm model is installed");
   return JSON.parse(str);
 }catch(e){
   if(e.name==="AbortError")throw Error("Ollama timed out");
   if(e.message.includes("fetch failed"))throw Error("Ollama is not running. Install Ollama and run: ollama pull qwen2.5-coder:3b");
   throw e;
 }finally{clearTimeout(timer)}
}
function parseFiles(str){
 let raw=text(str,500000);
 const tick=String.fromCharCode(96);
 if(raw.startsWith(tick+tick+tick)){
   const first=raw.indexOf("\n"),last=raw.lastIndexOf(tick+tick+tick);
   if(first>0&&last>first)raw=raw.slice(first+1,last).trim();
 }
 let v;try{v=JSON.parse(raw)}catch{throw Error("AI did not produce valid website JSON; try another local coding model")}
 const files=v?.files;
 if(!files||typeof files!=="object"||Array.isArray(files)||!files["index.html"])throw Error("Missing generated index.html");
 for(const [name,content] of Object.entries(files)){
   if(!ALLOWED.includes(name)||typeof content!=="string"||!content.trim()||content.length>90000)
     throw Error("Unsafe or oversized generated project file: "+name);
 }
 return files;
}
class LocalWorkspace{
 constructor({dataDir,cloud,shell,modelHub=null}){this.dataDir=path.join(dataDir,"BlorpWorkspace");this.cloud=cloud;this.shell=shell;this.modelHub=modelHub;this.busy=false}
 async root(){
   const {data,error}=await this.cloud.client.auth.getUser();
   if(error||!data.user||data.user.is_anonymous)throw Error("Please sign in to use your local workspace");
   const dir=path.join(this.dataDir,id(data.user.id));fs.mkdirSync(dir,{recursive:true});return dir;
 }
 async models(){
   try{const d=await api("/api/tags",null,4500);
     return {connected:true,models:(d.models||[]).map(x=>String(x.name||"")).filter(x=>x&&!x.endsWith(":cloud")).slice(0,70)};
   }catch(e){return {connected:false,models:[],error:e.message}}
 }
 async requireModel(model){
   const m=text(model,120),r=await this.models();
   if(!r.connected)throw Error(r.error);
   if(!r.models.includes(m))throw Error("Model not installed. Refresh the model list.");
   return m;
 }
 async list(){
   const r=await this.root();
   const summary=dir=>list(path.join(r,dir)).map(x=>({id:x.id,title:x.title,updated_at:x.updated_at})).sort((a,b)=>b.updated_at.localeCompare(a.updated_at));
   return {path:r,chats:summary("chats"),projects:summary("project-info")};
 }
 async newChat(title="New conversation"){
   const r=await this.root(),data={id:crypto.randomUUID(),title:String(title).slice(0,72),updated_at:new Date().toISOString(),messages:[]};
   save(path.join(r,"chats",data.id+".json"),data);return data;
 }
 async readChat(chatId){
   const r=await this.root(),thread=read(path.join(r,"chats",id(chatId)+".json"));
   if(!thread)throw Error("Conversation not found");return thread;
 }
 async chat({id:chatId,model,message}){
   if(this.busy)throw Error("A model is already responding");
   this.busy=true;
   try{
     const messageText=text(message,6000),m=await this.requireModel(model),r=await this.root();
     const thread=chatId?await this.readChat(chatId):await this.newChat(messageText.slice(0,60));
     const history=(thread.messages||[]).slice(-16).map(x=>({role:x.role,content:x.content}));
     const response=await api("/api/chat",{model:m,stream:false,options:{temperature:0.4,num_predict:1600},
       messages:[{role:"system",content:"You are Blorp, a helpful and accurate locally running coding and design assistant. Be clear about limitations. You cannot execute commands."},...history,{role:"user",content:messageText}]});
     const answer=text(response?.message?.content,50000);
     thread.messages.push({role:"user",content:messageText},{role:"assistant",content:answer});
     thread.messages=thread.messages.slice(-100);thread.updated_at=new Date().toISOString();
     save(path.join(r,"chats",thread.id+".json"),thread);
     return {thread,answer};
   }finally{this.busy=false}
 }
 async routedChat({id:chatId,message}){
   if(!this.modelHub)throw Error("Model Hub is unavailable");
   if(this.busy)throw Error("A model is already responding");
   this.busy=true;
   try{
     const input=text(message,6000),r=await this.root();
     const thread=chatId?await this.readChat(chatId):await this.newChat(input.slice(0,60));
     const history=(thread.messages||[]).slice(-14).map(m=>({role:m.role,content:m.content}));
     const out=await this.modelHub.infer("chat",{messages:[
       {role:"system",content:"You are Blorp AI, a practical software and design assistant. Do not claim to execute code or inspect files."},
       ...history,{role:"user",content:input}],stream:false,options:{num_predict:1600,temperature:0.4}});
     const answer=text(out?.message?.content,50000);
     thread.messages.push({role:"user",content:input},{role:"assistant",content:answer});
     thread.messages=thread.messages.slice(-100);thread.updated_at=new Date().toISOString();
     save(path.join(r,"chats",thread.id+".json"),thread);
     return {thread,answer,model:out.model,source:out.provider||"ollama"};
   }finally{this.busy=false}
 }
 async routedBuild({title,brief,focus="frontend"}){
   if(!this.modelHub)throw Error("Model Hub is unavailable");
   if(this.busy)throw Error("A model is already responding");
   this.busy=true;
   try{
     const name=text(title,90),req=text(brief,3500);
     const output=await runAgentBuild({title:name,brief:req,focus,model:"blorp:latest",parseFiles,
       infer:(body,task)=>this.modelHub.infer(task,body)});
     const r=await this.root(),projectId=crypto.randomUUID(),dir=path.join(r,"projects",projectId);
     fs.mkdirSync(dir,{recursive:true});
     for(const [file,content] of Object.entries(output.files))fs.writeFileSync(path.join(dir,file),content,"utf8");
     const info={id:projectId,title:name,updated_at:new Date().toISOString(),generated:true,focus,
       routing:"model-hub",agents:output.agents,tested:false};
     save(path.join(r,"project-info",projectId+".json"),info);
     return {info,files:output.files,path:dir,agent_steps:output.agents,
       warning:"Agent model replies have not been executed or independently tested. Three.js is not bundled by this static generator."};
   }finally{this.busy=false}
 }
 async cloudStatus(){
  const r=await this.cloud.client.functions.invoke("blorp-ai",{body:{action:"status"}});
  if(r.error){
    let detail="Cloud AI backend unavailable";
    try{if(r.error.context?.json){const x=await r.error.context.json();detail=x.error||detail}}catch{}
    return {configured:false,eligible:false,model:"openai/gpt-4o-mini",error:detail};
  }
  return r.data||{configured:false,eligible:false};
 }
 async cloudChat({id:chatId,message}){
  if(this.busy)throw Error("A model is already responding");
  this.busy=true;
  try{
   const input=text(message,3000),r=await this.root();
   const thread=chatId?await this.readChat(chatId):await this.newChat(input.slice(0,60));
   const history=(thread.messages||[]).slice(-4).map(m=>({role:m.role,content:String(m.content).slice(-1000)}));
   const call=await this.cloud.client.functions.invoke("blorp-ai",{
     body:{action:"chat",messages:[...history,{role:"user",content:input}]}
   });
   if(call.error||call.data?.error){
     let details=call.data?.error||"Could not reach Cloud AI.";
     try{if(call.error?.context?.json){const j=await call.error.context.json();details=j.error||details}}catch{}
     throw Error(details);
   }
   const answer=text(call.data?.answer,14000);
   thread.messages.push({role:"user",content:input},{role:"assistant",content:answer});
   thread.messages=thread.messages.slice(-100);thread.updated_at=new Date().toISOString();
   save(path.join(r,"chats",thread.id+".json"),thread);
   return {thread,answer,source:"cloud",model:call.data?.model,remaining:call.data?.remaining};
  }finally{this.busy=false}
 }
 async createProject({title}){
   const name=text(title,90),r=await this.root(),projectId=crypto.randomUUID(),dir=path.join(r,"projects",projectId);
   fs.mkdirSync(dir,{recursive:true});
   const safe=name.replace(/[<>&"]/g,"");
   const files={"index.html":'<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+safe+'</title><link rel="stylesheet" href="styles.css"></head><body><main><h1>'+safe+'</h1><p>Local Blorp project</p></main><script src="script.js"></script></body></html>',
     "styles.css":"body{font-family:system-ui;background:#0c171a;color:#d4f1dd;margin:0;padding:9vw}h1{font-size:clamp(2rem,6vw,5rem)}",
     "script.js":"console.log('Local Blorp project');"};
   for(const [file,content] of Object.entries(files))fs.writeFileSync(path.join(dir,file),content,"utf8");
   const info={id:projectId,title:name,updated_at:new Date().toISOString(),generated:false};
   save(path.join(r,"project-info",projectId+".json"),info);return {info,files,path:dir};
 }
 async readProject(projectId){
   const r=await this.root(),key=id(projectId),info=read(path.join(r,"project-info",key+".json"));
   if(!info)throw Error("Project not found");
   const dir=path.join(r,"projects",key),files={};
   for(const name of ALLOWED)files[name]=fs.existsSync(path.join(dir,name))?fs.readFileSync(path.join(dir,name),"utf8"):"";
   return {info,files,path:dir};
 }
 async saveProject({id:projectId,filename,content}){
   const p=await this.readProject(projectId);
   if(!ALLOWED.includes(filename)||typeof content!=="string"||content.length>90000)throw Error("Invalid file");
   fs.writeFileSync(path.join(p.path,filename),content,"utf8");
   p.info.updated_at=new Date().toISOString();
   save(path.join(await this.root(),"project-info",p.info.id+".json"),p.info);
   return {saved:true};
 }
 async openProject(projectId){const p=await this.readProject(projectId);const err=await this.shell.openPath(p.path);if(err)throw Error(err);return {opened:true}}
 async build({title,brief,model}){
   if(this.busy)throw Error("A model is already responding");
   this.busy=true;
   try{
     const name=text(title,90),req=text(brief,3500),m=await this.requireModel(model);
     const multi=await runAgentBuild({title:name,brief:req,model:m,parseFiles,
       infer:body=>api("/api/chat",body)});
     const files=multi.files;
     const r=await this.root(),projectId=crypto.randomUUID(),dir=path.join(r,"projects",projectId);
     fs.mkdirSync(dir,{recursive:true});
     for(const [file,content] of Object.entries(files))fs.writeFileSync(path.join(dir,file),content,"utf8");
     const info={id:projectId,title:name,updated_at:new Date().toISOString(),generated:true,model:m,agents:multi.agents,tested:false};
     save(path.join(r,"project-info",projectId+".json"),info);
     return {info,files,path:dir,agent_steps:multi.agents,warning:"Three local agent steps completed. Code was not executed or security tested."};
   }finally{this.busy=false}
 }
}
module.exports={LocalWorkspace,parseFiles};
