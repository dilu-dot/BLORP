"use strict";
const fs=require("node:fs"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
const {LocalWorkspace,parseFiles}=require("./native-workspace");
const root=fs.mkdtempSync(path.join(os.tmpdir(),"blorp-native-test-"));
const userId="ffb978fc-ecd1-4e12-b0b8-46c49f023112";
const cloud={client:{auth:{getUser:async()=>({data:{user:{id:userId,is_anonymous:false}},error:null})}}};
const engine=new LocalWorkspace({dataDir:root,cloud,shell:{openPath:async()=>""}});
let aiCalls=0;
global.fetch=async(url,opts)=>{
 if(String(url).endsWith("/api/tags"))return new Response(JSON.stringify({models:[{name:"test-coder:latest"}]}),{status:200});
 if(String(url).endsWith("/api/chat")){
  const data=JSON.parse(opts.body);
  if(data.format==="json"){aiCalls++;return new Response(JSON.stringify({message:{content:JSON.stringify({files:{"index.html":"<html><h1>Generated</h1></html>","styles.css":"h1{color:blue}","script.js":"console.log(1)"}})}}),{status:200});}
  aiCalls++;
  return new Response(JSON.stringify({message:{content:"Real mocked model response"}}),{status:200});
 }
 throw Error("Unexpected remote request "+url);
};
(async()=>{
 try{
  const m=await engine.models();assert.deepEqual(m.models,["test-coder:latest"]);
  const t=await engine.newChat("Test local thread");
  const chat=await engine.chat({id:t.id,model:m.models[0],message:"Hello model"});
  assert.equal(chat.answer,"Real mocked model response");
  assert.equal((await engine.readChat(t.id)).messages.length,2);
  const proj=await engine.createProject({title:"My local project"});
  assert.ok(fs.existsSync(path.join(proj.path,"index.html")));
  await engine.saveProject({id:proj.info.id,filename:"script.js",content:"console.log('saved')"});
  assert.equal((await engine.readProject(proj.info.id)).files["script.js"],"console.log('saved')");
  await assert.rejects(()=>engine.saveProject({id:proj.info.id,filename:"../../evil",content:"x"}));
  assert.deepEqual(Object.keys(parseFiles(JSON.stringify({files:{"index.html":"ok"}}))),["index.html"]);
  assert.throws(()=>parseFiles(JSON.stringify({files:{"../../evil":"x","index.html":"ok"}})));
  const generated=await engine.build({title:"Generated local site",brief:"Make a landing page",model:m.models[0]});
  assert.ok(fs.existsSync(path.join(generated.path,"styles.css")));
  assert.equal(generated.agent_steps.length,3);
  assert.equal(generated.info.tested,false);
  assert.equal(aiCalls,4);
  const result=await engine.list();assert.equal(result.projects.length,2);assert.equal(result.chats.length,1);
  assert.equal(await engine.openProject(proj.info.id).then(x=>x.opened),true);
  console.log("Local workspace and Ollama mocked inference tests passed.");
 }finally{fs.rmSync(root,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
