"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),os=require("node:os"),path=require("node:path");
const {ModelHub,DEFAULT_ALIAS,PROVIDERS,TASKS}=require("./model-hub");
const {LocalWorkspace}=require("./native-workspace");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"blorp-hub-test-"));
const uid="14018fb1-401a-46ec-bce5-1d3479229522";
const cloud={client:{auth:{getUser:async()=>({data:{user:{id:uid,is_anonymous:false}},error:null})}}};
let secure=true,network=[],installed=["qwen3.5:4b"];
const fakeSeal=s=>Buffer.from([...Buffer.from(s,"utf8")].map(b=>b^0x5a));
const fakeUnseal=b=>Buffer.from([...b].map(x=>x^0x5a)).toString("utf8");
const safeStorage={isEncryptionAvailable:()=>secure,
 encryptString:s=>fakeSeal(s),decryptString:b=>fakeUnseal(b)};
global.fetch=async(url,opts={})=>{
 const value=String(url);
 const data=opts.body?JSON.parse(opts.body):{};
 network.push({url:value,model:data.model,headers:opts.headers||{},messages:data.messages||[]});
 if(value.endsWith("/api/tags"))return new Response(JSON.stringify({models:installed.map(name=>({name}))}),{status:200});
 if(value.endsWith("/api/create")){
  assert.equal(data.model,"blorp");assert.ok(data.from==="qwen3.5:4b"||data.from==="qwen2.5-coder:1.5b");
  installed.push(DEFAULT_ALIAS);return new Response(JSON.stringify({status:"success"}),{status:200});
 }
 if(value.endsWith("/api/pull")){
  installed.push(data.model);
  return new Response(new ReadableStream({start(controller){
   controller.enqueue(new TextEncoder().encode('{"status":"pulling manifest"}\n{"status":"success"}\n'));controller.close();
  }}),{status:200});
 }
 if(value.endsWith("/api/chat"))return new Response(JSON.stringify({message:{content:"Local model answer"}}),{status:200});
 if(value==="https://api.openai.com/v1/chat/completions"||value==="https://openrouter.ai/api/v1/chat/completions"||value==="https://api.groq.com/openai/v1/chat/completions"){
  assert.ok(opts.headers.authorization.startsWith("Bearer "));
  const answer=data.messages?.some(x=>String(x.content).includes("Architect plan"))?
    JSON.stringify({files:{"index.html":"<!doctype html><html><body>Model Hub</body></html>","styles.css":"body{color:blue}","script.js":"console.log(1)"}}):
    "Provider response";
  return new Response(JSON.stringify({choices:[{message:{content:answer}}]}),{status:200});
 }
 if(value.includes("generativelanguage.googleapis.com")){
  assert.equal(opts.headers["x-goog-api-key"],"google-demo-key");
  return new Response(JSON.stringify({candidates:[{content:{parts:[{text:"Gemini works"}]}}]}),{status:200});
 }
 if(value==="https://api.anthropic.com/v1/messages"){
  assert.equal(opts.headers["x-api-key"],"anthropic-demo-key");
  return new Response(JSON.stringify({content:[{type:"text",text:"Claude works"}]}),{status:200});
 }
 throw Error("Unrecognized test request "+value);
};
(async()=>{
 try{
  const hub=new ModelHub({dataDir:root,cloud,safeStorage});
  let cat=await hub.catalog();
  assert.equal(cat.ollama.connected,true);assert.equal(cat.providers.length,Object.keys(PROVIDERS).length);
  assert.equal(TASKS.length,7);assert.equal(cat.routes.threejs.model,DEFAULT_ALIAS);
  assert.equal(cat.providers.filter(x=>x.connected).length,0);
  let progress=[];
  const setup=await hub.installDefault({base:"balanced"},x=>progress.push(x.status));
  assert.equal(setup.model,DEFAULT_ALIAS);assert.ok(progress.includes("Blorp is installed and ready"));
  assert.equal((await hub.installDefault({base:"balanced"})).alreadyPresent,true);
  const local=await hub.infer("chat",{messages:[{role:"user",content:"Hello"}]});
  assert.equal(local.message.content,"Local model answer");
  await hub.connectProvider({provider:"openai",key:"openai-demo-key"});
  await hub.connectProvider({provider:"openrouter",key:"router-demo-key"});
  await hub.connectProvider({provider:"gemini",key:"google-demo-key"});
  await hub.connectProvider({provider:"anthropic",key:"anthropic-demo-key"});
  const vaultFile=path.join(root,"BlorpModelHub","keys-"+uid+".enc");
  assert.ok(fs.existsSync(vaultFile));
  assert.ok(!fs.readFileSync(vaultFile,"utf8").includes("openai-demo-key"));
  cat=await hub.catalog();
  assert.equal(cat.providers.filter(x=>x.connected).length,4);
  assert.equal(JSON.stringify(cat).includes("openai-demo-key"),false);
  await hub.setRoute({task:"chat",kind:"provider",provider:"openai",model:"gpt-test-model"});
  assert.equal((await hub.infer("chat",{messages:[{role:"user",content:"Hello"}]})).message.content,"Provider response");
  assert.equal((await hub.testProvider({provider:"openai",model:"gpt-test-model"})).success,true);
  await hub.setRoute({task:"landing",kind:"provider",provider:"openrouter",model:"vendor/coding-test"});
  const localWorkspace=new LocalWorkspace({dataDir:root,cloud,shell:{openPath:async()=>""},modelHub:hub});
  const routed=await localWorkspace.routedBuild({title:"Hub test",brief:"Build a landing page",focus:"landing"});
  assert.equal(routed.info.focus,"landing");
  assert.equal(routed.info.agents.length,3);
  assert.equal(routed.info.tested,false);
  assert.ok(fs.existsSync(path.join(routed.path,"index.html")));
  assert.ok(network.some(x=>x.url.includes("openrouter.ai")&&x.model==="vendor/coding-test"));
  assert.equal((await localWorkspace.routedChat({message:"Test"})).answer,"Provider response");
  await hub.setRoute({task:"qa",kind:"provider",provider:"gemini",model:"gemini-test"});
  assert.equal((await hub.infer("qa",{messages:[{role:"user",content:"Check"}]})).message.content,"Gemini works");
  await hub.setRoute({task:"animations",kind:"provider",provider:"anthropic",model:"claude-test"});
  assert.equal((await hub.infer("animations",{messages:[{role:"user",content:"Animate"}]})).message.content,"Claude works");
  await assert.rejects(()=>hub.setRoute({task:"chat",kind:"provider",provider:"arbitrary-url",model:"x"}));
  await assert.rejects(()=>hub.setRoute({task:"chat",kind:"provider",provider:"openai",model:"https://bad?x=key"}));
  await hub.disconnectProvider({provider:"openai"});
  await assert.rejects(()=>hub.infer("chat",{messages:[{role:"user",content:"Hello"}]}),/No API key/);
  secure=false;
  await assert.rejects(()=>hub.connectProvider({provider:"groq",key:"groq-secret-value"}),/Secure OS key storage/);
  assert.ok(!network.some(x=>x.url.includes("evil")));
  console.log("Blorp Model Hub: encrypted BYOK, local installer, seven routes, Gemini/Claude adapters and routed builder tests passed.");
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
