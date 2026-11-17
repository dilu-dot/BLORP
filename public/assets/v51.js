/* Blorp V5.1: Real local Ollama requests. UI never executes generated code. */
(() => {
 'use strict';
 const el=id=>document.getElementById(id);
 const modeButtons=[...document.querySelectorAll('[data-local-mode]')];
 let mode='chat',busy=false,history=[];
 const showStatus=(message,kind='')=>{const e=el('localStatus');e.textContent=message;e.className='local-status '+kind;};
 const append=(role,content)=>{
   const box=document.createElement('div');box.className='local-message '+role;
   const lead=document.createElement('strong');lead.textContent=role==='user'?'You':'Blorp · local Ollama';
   const body=document.createElement('div');body.textContent=content;
   box.append(lead,body);el('localChatThread').append(box);
   el('localChatThread').scrollTop=el('localChatThread').scrollHeight;
   return body;
 };
 const call=async(path,obj)=>{
   const resp=await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)});
   const answer=await resp.json();if(!resp.ok)throw Error(answer.error||`Request failed (HTTP ${resp.status})`);
   return answer;
 };
 async function reload(){
   const select=el('localModel');const old=select.value;select.replaceChildren(new Option('Checking Ollama…',''));
   showStatus('Connecting to Ollama running on this computer…');
   try{
     const resp=await fetch('/api/local/models',{credentials:'same-origin'});const data=await resp.json();
     if(!resp.ok)throw Error(data.error||'Ollama is not running');
     select.replaceChildren();
     const items=data.models||[];
     if(!items.length){select.add(new Option('No models installed — run ollama pull', ''));showStatus('Ollama is online, but no models are installed. Run ollama pull qwen2.5-coder:3b or another model in PowerShell.','problem');return;}
     items.forEach(model=>select.add(new Option(model,model)));
     if(items.includes(old))select.value=old;
     showStatus('Connected to local Ollama · '+items.length+' installed model(s) detected. Model inference is performed on your PC.','ok');
   }catch(err){select.replaceChildren(new Option('Ollama offline',''));showStatus(err.message+' · Install Ollama and run it, then click Detect Ollama.','problem');}
 }
 async function run(){
   if(busy)return;
   const model=el('localModel').value;
   const prompt=el('localInput').value.trim();
   if(!model){showStatus('Choose an installed Ollama model first.','problem');return}
   if(prompt.length<5){showStatus('Write a prompt of at least 5 characters.','problem');return}
   busy=true;el('localRun').disabled=true;modeButtons.forEach(b=>b.disabled=true);el('localModel').disabled=true;el('localDownload').hidden=true;
   const prev=el('localRun').textContent;el('localRun').textContent='Working on your PC…';
   showStatus(mode==='chat'?'Your local model is composing a response…':'Architect → Builder → QA: your local model may take several minutes. Nothing is being executed.','ok');
   const input=el('localInput');input.value='';
   try{
     if(mode==='chat'){
       append('user',prompt);
       const live=append('assistant','Thinking locally…');
       const response=await call('/api/local/chat',{model,message:prompt,history});
       live.textContent=response.reply;
       history.push({role:'user',content:prompt},{role:'assistant',content:response.reply});
       history=history.slice(-10);
       showStatus(`Local chat complete · ${response.usage.completion_tokens} output tokens · no paid API used.`,'ok');
     } else {
       const output=el('localBuildOutput');output.replaceChildren();
       const status=document.createElement('p');status.textContent='Working: planning, coding, and reviewing the website. This may take several minutes…';output.append(status);
       const response=await call('/api/local/agents/build',{model,brief:prompt});
       output.replaceChildren();
       const section=(title,content)=>{const h=document.createElement('h3');h.textContent=title;const p=document.createElement('p');p.textContent=content;output.append(h,p)};
       section('Architect plan',response.plan);
       section('Generated files',response.files.join(' · '));
       section('QA review (model only)',response.review);
       section('Execution status','Not executed. No scripts, builds, or tests have been run.');
       const link=el('localDownload');link.href=response.download_url;link.hidden=false;
       showStatus(`Agent run completed · ${response.files.length} files generated · ${response.usage.completion_tokens} output tokens.`,'ok');
     }
   }catch(err){el('localInput').value=prompt;showStatus('Local run failed: '+err.message,'problem');if(mode==='build')el('localBuildOutput').textContent=err.message;else append('assistant','Request failed: '+err.message)}
   finally{busy=false;el('localRun').disabled=false;modeButtons.forEach(b=>b.disabled=false);el('localModel').disabled=false;el('localRun').textContent=prev;}
 }
 function changeMode(value){mode=value;modeButtons.forEach(b=>b.classList.toggle('active',b.dataset.localMode===value));el('localInputLabel').textContent=value==='build'?'Describe the website you want the agents to build':'Message your local model';el('localInput').placeholder=value==='build'?'Build a responsive bakery website with a warm palette, a menu and contact section…':'Ask Blorp anything…';el('localRun').textContent=value==='build'?'✦ Run three agents':'↑ Send to local model';el('localClear').hidden=value==='build';}
 modeButtons.forEach(b=>b.addEventListener('click',()=>changeMode(b.dataset.localMode)));
 el('localRun').addEventListener('click',run);
 el('localInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&mode==='chat'&&!e.isComposing){e.preventDefault();run()}});
 el('localClear').addEventListener('click',()=>{history=[];el('localChatThread').replaceChildren();const intro=document.createElement('div');intro.className='local-welcome';intro.textContent='Fresh local conversation. What would you like to ask?';el('localChatThread').append(intro)});
 el('localRefresh').addEventListener('click',reload);
 const previewOnly=window.location.protocol==='file:';
 const nav=el('localAiNav');nav.addEventListener('click',()=>{if(window.blorpAuthorizeView&&!window.blorpAuthorizeView('localai'))return;changeView('localai');el('crumb').textContent='Local AI Lab';if(!previewOnly)reload()});
 if(previewOnly){el('localModel').replaceChildren(new Option('Start Blorp server to use Ollama',''));showStatus('UI-only preview. To connect real local AI, extract the project ZIP, start Python with START_BLORP_WINDOWS.bat and open the localhost URL shown.','problem');el('localRun').disabled=true;}
 else{reload()}
 if(window.location.hash==='#localai'){nav.click()}
})();
