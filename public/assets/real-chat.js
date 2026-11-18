/* Real single-model chat for the legacy AI Playground. No agents or shell execution. */
(()=>{
"use strict";
const root=document.getElementById("playground"),send=document.getElementById("send");
const composer=document.getElementById("prompt"),model=document.getElementById("aiModel"),thread=document.getElementById("messages");
if(!root||!send||!composer||!model||!thread)return;
let busy=false,history=[];
const trust=root.querySelector(".ai-trust");
if(trust)trust.textContent="Local Ollama · one selected model · sign-in required";
const hint=root.querySelector(".ai-composefoot span");
if(hint)hint.textContent="Runs through the local BLORP Python backend. No specialist agents.";
thread.replaceChildren();
function bubble(role,content){
 const node=document.createElement("div");node.className="bubble"+(role==="user"?" user":"");
 node.textContent=content;thread.append(node);thread.scrollTop=thread.scrollHeight;return node;
}
bubble("assistant","Blorp is ready to connect to a local Ollama model. Sign in and select an installed model.");
async function json(path,body){
 const res=await fetch(path,{method:body?"POST":"GET",credentials:"same-origin",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined,cache:"no-store"});
 const data=await res.json();if(!res.ok)throw Error(data.error||("HTTP "+res.status));return data;
}
async function models(){
 model.replaceChildren(new Option("Checking local models…",""));model.disabled=true;
 try{
  const data=await json("/api/local/models");
  const list=Array.isArray(data.models)?data.models:[];
  model.replaceChildren(...list.map(name=>new Option(name,name)));
  if(!list.length){model.add(new Option("No local models installed",""));bubble("assistant","Install and start Ollama, then run: ollama pull qwen2.5-coder:3b");}
 }catch(e){model.replaceChildren(new Option("Ollama offline",""));bubble("assistant","Model connection: "+e.message);}
 finally{model.disabled=false;}
}
async function run(){
 if(busy)return;
 const message=composer.value.trim();
 if(!message)return;
 if(message.length<5||message.length>3000){bubble("assistant","Enter a message between 5 and 3000 characters.");return;}
 const selected=model.value;
 if(!selected){bubble("assistant","No local model is selected. Start Ollama and refresh available models.");return;}
 busy=true;send.disabled=true;
 const old=send.textContent;send.textContent="…";
 composer.value="";
 bubble("user",message);
 const reply=bubble("assistant","Thinking locally…");
 try{
  const result=await json("/api/local/chat",{model:selected,message,history});
  reply.textContent=String(result.reply||"No response returned.");
  history.push({role:"user",content:message},{role:"assistant",content:reply.textContent});
  history=history.slice(-10);
 }catch(e){reply.textContent="Request failed: "+e.message;composer.value=message;}
 finally{busy=false;send.disabled=false;send.textContent=old;}
}
send.addEventListener("click",e=>{e.preventDefault();e.stopImmediatePropagation();run()},true);
composer.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey&&!e.isComposing){e.preventDefault();e.stopImmediatePropagation();run()}},true);
const clear=document.getElementById("clearChat");
clear?.addEventListener("click",()=>{history=[];thread.replaceChildren();bubble("assistant","Fresh local chat. What would you like to ask?")});
const refresh=document.createElement("button");refresh.className="btn";refresh.type="button";refresh.textContent="↻ Models";
refresh.addEventListener("click",models);
model.insertAdjacentElement("afterend",refresh);
models();
})();