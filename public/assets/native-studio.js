/* BLORP LOCAL STUDIO: native on-device files, conversations and local Ollama. */
(()=>{
"use strict";
if(!window.blorpStudio)return;
const engine=window.blorpStudio,nav=document.getElementById("mainnav"),account=document.getElementById("account");
if(!nav||!account)return;
const section=document.createElement("section");section.className="tab";section.id="native";
section.innerHTML=
'<div class="studio-head"><div><p class="studio-kicker">BLORP // LOCAL-FIRST ENGINE</p><h1>Build something <em>real.</em></h1><p>Actual files on your computer. Real AI through your own Ollama. No cloud chat storage.</p></div><span class="studio-flag">LOCAL WORKSPACE</span></div>'+
'<div class="studio-top"><div class="studio-connection"><span class="studio-dot" id="studioDot"></span><strong id="studioConnection">Checking local AI…</strong></div><label>Ollama model <select id="studioModel"><option value="">Detecting…</option></select></label><button type="button" id="studioDetect">Refresh models</button></div>'+
'<div class="studio-nav"><button type="button" data-studio-page="chat" class="selected">✦ AI Chat</button><button type="button" data-studio-page="build">⌘ Website Builder</button><button type="button" data-studio-page="projects">▣ My Projects</button></div>'+
'<p class="studio-feedback" id="studioFeedback" role="status" aria-live="polite">Your conversations and projects are stored locally.</p>'+
'<div id="studioChatPage" class="studio-chat-grid">'+
'<aside class="studio-panel studio-threads"><div class="studio-title-row"><h2>Conversations</h2><button type="button" id="studioNewChat">+ New</button></div><div id="studioThreads"></div></aside>'+
'<div class="studio-panel studio-chat"><div class="studio-title-row"><h2>Ask Blorp</h2><span>Running on your PC</span></div><div id="studioMessages" class="studio-messages" aria-live="polite"></div><form id="studioChatForm"><textarea id="studioChatInput" rows="3" maxlength="6000" placeholder="Ask about code, design, bugs or your next idea…" required></textarea><button type="submit" id="studioSend">Send to local AI</button></form></div></div>'+
'<div id="studioBuildPage" hidden class="studio-panel studio-build"><div class="studio-title-row"><div><h2>Generate a working website</h2><p>Single-pass local coding model, saved to your Windows user folder.</p></div></div><form id="studioBuildForm"><label>Project name<input id="studioBuildTitle" maxlength="90" required placeholder="Aurora Creative Studio"></label><label>Describe the site<textarea id="studioBrief" rows="6" maxlength="3500" required placeholder="Build a responsive portfolio with animated hero, elegant services and contact form…"></textarea></label><button type="submit" id="studioGenerate">Generate HTML / CSS / JS</button></form><p class="studio-hint">Requires Ollama running locally and a coding model installed. Generated code needs review; Blorp does not execute shell commands.</p></div>'+
'<div id="studioProjectsPage" hidden class="studio-project-grid"><aside class="studio-panel"><div class="studio-title-row"><h2>Saved projects</h2><button type="button" id="studioCreateProject">+ New</button></div><div id="studioProjects"></div></aside><div class="studio-panel studio-editor"><div class="studio-title-row"><div><h2 id="studioActiveProject">Select a project</h2><p>Editable source files stored on your computer</p></div><button type="button" id="studioOpenFolder" disabled>Open folder</button></div><div class="studio-file-tabs"><button type="button" data-studio-file="index.html" class="selected">index.html</button><button type="button" data-studio-file="styles.css">styles.css</button><button type="button" data-studio-file="script.js">script.js</button></div><textarea id="studioCode" spellcheck="false" placeholder="Choose a project to edit" disabled></textarea><div class="studio-editor-actions"><button type="button" id="studioSave" disabled>Save file</button><button type="button" id="studioPreviewBtn" disabled>Refresh preview</button></div><iframe id="studioPreviewFrame" sandbox="allow-scripts" title="Sandboxed local website preview" referrerpolicy="no-referrer"></iframe></div></div>'+
'<div class="studio-footer">AI inference is entirely local using Ollama. No arbitrary code execution or cloud website uploads. Advanced multi-agent tasks are not ready yet.</div>';
account.parentNode.append(section);
const $=id=>document.getElementById(id);
const launch=document.createElement("button");launch.type="button";launch.textContent="✦ Local AI Studio";launch.dataset.view="native";
nav.prepend(launch);
nav.querySelectorAll("button").forEach(b=>{if(b!==launch)b.hidden=true;});
document.querySelectorAll(".buildfast-section").forEach(x=>x.hidden=true);
const state={page:"chat",models:[],thread:null,project:null,filename:"index.html",dirty:false,working:false};
function status(message,bad=false){$("studioFeedback").textContent=message;$("studioFeedback").classList.toggle("error",bad)}
function busy(value){state.working=value;for(const id of ["studioSend","studioGenerate","studioDetect","studioNewChat","studioCreateProject"])$(id).disabled=value;}
async function invoke(action,payload){try{return await engine.invoke(action,payload)}catch(e){throw Error(String(e.message||e).replace(/^Error invoking remote method '[^']+': Error:\s*/,""))}}
function show(page){
 if(state.dirty&&!confirm("Discard unsaved changes to "+state.filename+"?"))return;
 state.page=page;
 $("studioChatPage").hidden=page!=="chat";$("studioBuildPage").hidden=page!=="build";$("studioProjectsPage").hidden=page!=="projects";
 section.querySelectorAll("[data-studio-page]").forEach(b=>b.classList.toggle("selected",b.dataset.studioPage===page));
 status(page==="chat"?"Your conversations stay on this PC.":page==="build"?"Build a real static website with an installed Ollama model.":"Your source files are stored on this PC.");
}
function enter(page="chat"){
 changeView("native");
 $("crumb").textContent="Local AI Studio";
 document.querySelector("#sidebar")?.classList.remove("open");
 show(page);
}
launch.addEventListener("click",()=>enter());
section.querySelectorAll("[data-studio-page]").forEach(b=>b.addEventListener("click",()=>show(b.dataset.studioPage)));
document.addEventListener("click",e=>{
 const link=e.target.closest('[data-open="builder"],[data-view="builder"],[data-open="playground"],[data-view="playground"],[data-view="projects"]');
 if(!link)return;
 e.preventDefault();e.stopImmediatePropagation();
 enter(link.dataset.view==="projects"?"projects":link.dataset.view==="builder"||link.dataset.open==="builder"?"build":"chat");
},true);
async function models(){
 const data=await invoke("models");
 state.models=data.models||[];
 $("studioDot").classList.toggle("connected",Boolean(data.connected));
 $("studioConnection").textContent=data.connected?data.models.length+" local model(s) ready":"Ollama not running";
 const old=$("studioModel").value;$("studioModel").replaceChildren();
 if(!data.connected||!data.models.length)$("studioModel").add(new Option(data.connected?"Install a local model first":"Install & start Ollama",""));
 else for(const model of data.models)$("studioModel").add(new Option(model,model));
 if(data.models.includes(old))$("studioModel").value=old;
 else if(data.models.length){const coder=data.models.find(x=>/coder|qwen|code|llama/i.test(x));if(coder)$("studioModel").value=coder;}
 if(!data.connected)status(data.error||"Install Ollama from ollama.com and pull qwen2.5-coder:3b",true);
 else if(!data.models.length)status("Ollama is running but has no models. Run: ollama pull qwen2.5-coder:3b",true);
}
async function list(){
 const data=await invoke("list");$("studioThreads").replaceChildren();$("studioProjects").replaceChildren();
 for(const chat of data.chats||[]){const b=document.createElement("button");b.type="button";b.className="studio-list-item";b.textContent=chat.title||"Conversation";b.addEventListener("click",()=>openThread(chat.id));$("studioThreads").append(b);}
 if(!data.chats?.length)$("studioThreads").textContent="No conversations yet.";
 for(const project of data.projects||[]){const b=document.createElement("button");b.type="button";b.className="studio-list-item";b.textContent=project.title;b.addEventListener("click",()=>openProject(project.id));$("studioProjects").append(b);}
 if(!data.projects?.length)$("studioProjects").textContent="Create your first project.";
 return data;
}
function drawThread(){
 $("studioMessages").replaceChildren();
 const messages=state.thread?.messages||[];
 if(!messages.length){const p=document.createElement("p");p.className="studio-blank";p.textContent="A real local AI conversation starts here. Select an installed Ollama model and send your first message.";$("studioMessages").append(p);}
 for(const m of messages){
  const el=document.createElement("div");el.className="studio-bubble "+(m.role==="user"?"mine":"reply");
  const label=document.createElement("small");label.textContent=m.role==="user"?"You":"Blorp · local AI";
  const body=document.createElement("div");body.textContent=m.content;
  el.append(label,body);$("studioMessages").append(el);
 }
 $("studioMessages").scrollTop=$("studioMessages").scrollHeight;
}
async function openThread(id){state.thread=await invoke("readChat",{id});drawThread();show("chat")}
$("studioNewChat").addEventListener("click",async()=>{try{state.thread=await invoke("newChat",{});drawThread();await list();show("chat");}catch(e){status(e.message,true)}});
$("studioChatForm").addEventListener("submit",async e=>{
 e.preventDefault();if(state.working)return;
 const message=$("studioChatInput").value.trim(),model=$("studioModel").value;
 if(!message||!model){status("Install Ollama and select a local model first.",true);return}
 busy(true);status("Waiting for a real response from "+model+"…");
 try{
   const data=await invoke("chat",{id:state.thread?.id,model,message});
   state.thread=data.thread;$("studioChatInput").value="";drawThread();await list();
   status("Response generated locally and conversation saved on this PC.");
 }catch(err){status(err.message,true)}finally{busy(false)}
});
async function openProject(id){
 if(state.dirty&&!confirm("Discard unsaved changes?"))return;
 state.project=await invoke("readProject",{id});state.filename="index.html";state.dirty=false;
 $("studioActiveProject").textContent=state.project.info.title;
 $("studioCode").disabled=false;$("studioSave").disabled=false;$("studioPreviewBtn").disabled=false;$("studioOpenFolder").disabled=false;
 drawFile();show("projects");
}
function drawFile(){
 section.querySelectorAll("[data-studio-file]").forEach(b=>b.classList.toggle("selected",b.dataset.studioFile===state.filename));
 $("studioCode").value=state.project?.files[state.filename]||"";state.dirty=false;
}
$("studioCode").addEventListener("input",()=>{state.dirty=true});
section.querySelectorAll("[data-studio-file]").forEach(b=>b.addEventListener("click",()=>{
 if(state.dirty&&!confirm("Discard unsaved changes?"))return;
 state.filename=b.dataset.studioFile;drawFile();
}));
$("studioSave").addEventListener("click",async()=>{
 try{await invoke("saveProject",{id:state.project.info.id,filename:state.filename,content:$("studioCode").value});
  state.project.files[state.filename]=$("studioCode").value;state.dirty=false;status("Saved "+state.filename+" on your Windows PC.");
 }catch(e){status(e.message,true)}
});
function preview(){
 if(!state.project)return;
 if(state.dirty){status("Save your file before refreshing the preview.",true);return}
 const files=state.project.files,css=String(files["styles.css"]||"").replace(/<\/style/gi,"<\\/style");
 const js=String(files["script.js"]||"").replace(/<\/script/gi,"<\\/script");
 const raw=String(files["index.html"]||"").replace(/<link\b[^>]*href=["']styles\.css["'][^>]*>/gi,"").replace(/<script\b[^>]*src=["']script\.js["'][^>]*>\s*<\/script>/gi,"");
 const csp="<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; form-action 'none'; frame-src 'none'\">";
 $("studioPreviewFrame").srcdoc=csp+raw+"<style>"+css+"</style><script>"+js+"</script>";
 status("Sandboxed preview updated. Scripts have no filesystem or network access.");
}
$("studioPreviewBtn").addEventListener("click",preview);
$("studioOpenFolder").addEventListener("click",async()=>{try{await invoke("openProject",{id:state.project.info.id});status("Opened your local project folder.")}catch(e){status(e.message,true)}});
$("studioCreateProject").addEventListener("click",async()=>{
 const name=prompt("Project name","My new website");if(!name)return;
 try{const p=await invoke("createProject",{title:name});await list();await openProject(p.info.id);status("Project created as real HTML/CSS/JS files on your PC.");preview()}catch(e){status(e.message,true)}
});
$("studioBuildForm").addEventListener("submit",async e=>{
 e.preventDefault();if(state.working)return;
 const title=$("studioBuildTitle").value.trim(),brief=$("studioBrief").value.trim(),model=$("studioModel").value;
 if(!model){status("Install Ollama and select a local coding model first.",true);return}
 busy(true);status("Generating real source files using "+model+". Local models may take several minutes…");
 try{
   const p=await invoke("build",{title,brief,model});
   await list();await openProject(p.info.id);preview();
   status("Generated "+Object.keys(p.files).length+" real project files in your local workspace. Review AI output before sharing.");
 }catch(err){status(err.message,true)}finally{busy(false)}
});
$("studioDetect").addEventListener("click",()=>models().catch(e=>status(e.message,true)));
window.addEventListener("blorp:authchange",e=>{
 if(e.detail){list().then(()=>models()).then(()=>{enter("chat");drawThread()}).catch(err=>status(err.message,true));}
 else {state.thread=null;state.project=null;section.classList.remove("active")}
});
})();
