
const models=[{name:'Gemini Flash',provider:'Google',cap:'Multimodal',lat:'~0.8s',icon:'✦'},{name:'Llama Instruct',provider:'Groq',cap:'Fast chat',lat:'~0.4s',icon:'◇'},{name:'Codestral',provider:'Mistral',cap:'Coding',lat:'~1.1s',icon:'⌘'},{name:'Qwen Coder',provider:'OpenRouter',cap:'Coding',lat:'~1.0s',icon:'◈'},{name:'DeepSeek',provider:'NVIDIA',cap:'Reasoning',lat:'~1.4s',icon:'△'},{name:'Command R',provider:'Cohere',cap:'Retrieval',lat:'~1.2s',icon:'▧'}];
const providers=[{name:'Google AI',subtitle:'Gemini family',letter:'G',enabled:true,load:68},{name:'Groq',subtitle:'Low-latency models',letter:'ϟ',enabled:true,load:41},{name:'Mistral',subtitle:'Open model family',letter:'M',enabled:true,load:55},{name:'OpenRouter',subtitle:'Multiple model routes',letter:'O',enabled:true,load:38},{name:'NVIDIA',subtitle:'Hosted inference',letter:'N',enabled:true,load:23},{name:'Cohere',subtitle:'Command models',letter:'C',enabled:true,load:62},{name:'Cerebras',subtitle:'High-speed inference',letter:'◎',enabled:false,load:0},{name:'Hugging Face',subtitle:'Community models',letter:'H',enabled:false,load:0}];
let toastTimeout;function showToast(s){const t=document.querySelector('#toast');t.textContent=s;t.classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>t.classList.remove('visible'),2800)}
function changeView(id){if(window.blorpAuthorizeView&&!window.blorpAuthorizeView(id))return;document.querySelectorAll('.tab').forEach(el=>el.classList.toggle('active',el.id===id));document.querySelectorAll('[data-view]').forEach(el=>el.classList.toggle('active',el.dataset.view===id));const labels={account:'Dashboard',projects:'Projects',addons:'Add-ons',membership:'Membership',overview:'Overview',models:'Model Explorer',playground:'Playground',providers:'Providers',keys:'API Keys',analytics:'Analytics',multitask:'Multi Task',builder:'Build Playground',workflows:'Workflows',settings:'Settings',owner:'Owner Console'};document.querySelector('#crumb').textContent=labels[id];document.querySelector('#sidebar').classList.remove('open');document.querySelector('#overlay').classList.remove('open');scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('[data-view],[data-open]').forEach(el=>el.addEventListener('click',()=>changeView(el.dataset.view||el.dataset.open)));
function modelRows(arr){return arr.map(x=>`<tr><td><span class="modelicon">${x.icon}</span><b>${x.name}</b></td><td>${x.provider}</td><td>${x.cap}</td><td class="monospace">${x.lat}</td><td><span class="status">● Sample</span></td></tr>`).join('')}
function renderModels(filter=''){document.querySelector('#allModels').innerHTML=modelRows(models.filter(m=>(m.name+' '+m.provider+' '+m.cap).toLowerCase().includes(filter.toLowerCase())))||'<tr><td colspan="5">No matching models</td></tr>';document.querySelector('#overviewModels').innerHTML=modelRows(models.slice(0,4))}renderModels();document.querySelector('#modelSearch').addEventListener('input',e=>renderModels(e.target.value));
function renderProviders(){document.querySelector('#overviewProviders').innerHTML=providers.slice(0,4).map(p=>`<div class="prov"><div class="prov-icon">${p.letter}</div><div class="prov-main"><b>${p.name}</b><small>${p.subtitle}</small><div class="usagebar"><div style="width:${p.load}%"></div></div></div><span class="status ${p.enabled?'':'off'}">● ${p.enabled?'Demo':'Off'}</span></div>`).join('');document.querySelector('#providerList').innerHTML=providers.map((p,i)=>`<div class="prov"><div class="prov-icon">${p.letter}</div><div class="prov-main"><b>${p.name}</b><small>${p.subtitle} · ${p.enabled?'Enabled in preview':'Disabled in preview'}</small></div><button class="toggle ${p.enabled?'on':''}" data-toggleprovider="${i}" aria-label="Toggle ${p.name}" aria-pressed="${p.enabled}"></button></div>`).join('');document.querySelectorAll('[data-toggleprovider]').forEach(el=>el.addEventListener('click',()=>{let i=Number(el.dataset.toggleprovider);providers[i].enabled=!providers[i].enabled;renderProviders();showToast(providers[i].name+' preview status updated')}))}renderProviders();
function submitPrompt(){const text=document.querySelector('#prompt').value.trim();if(!text)return;const wrap=document.querySelector('#messages');const u=document.createElement('div');u.className='bubble user';u.textContent=text;wrap.appendChild(u);document.querySelector('#prompt').value='';const ai=document.createElement('div');ai.className='bubble';ai.textContent='This is a visual demonstration of Blorp. Once we connect the original FreeLLM backend, this area will stream real model responses and show routing details.';wrap.appendChild(ai);wrap.scrollTop=wrap.scrollHeight}document.querySelector('#send').addEventListener('click',submitPrompt);document.querySelector('#prompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();submitPrompt()}});document.querySelector('#clearChat').addEventListener('click',()=>{document.querySelector('#messages').innerHTML='<div class="bubble">Fresh conversation. What would you like to try?</div>';showToast('Preview conversation cleared')});
document.querySelector('#endpointBtn').addEventListener('click',()=>{showToast('Demo only — endpoint becomes available after backend setup')});document.querySelector('#notice').addEventListener('click',()=>showToast('Blorp V1 — interactive design preview, not a connected application'));document.querySelector('#addProvider').addEventListener('click',()=>showToast('Connect provider workflow in the next implementation phase'));document.querySelector('#addKey').addEventListener('click',()=>showToast('API keys are intentionally disabled in the demo for safety'));
document.querySelector('#hamburger').addEventListener('click',()=>{document.querySelector('#sidebar').classList.add('open');document.querySelector('#overlay').classList.add('open')});document.querySelector('#overlay').addEventListener('click',()=>{document.querySelector('#sidebar').classList.remove('open');document.querySelector('#overlay').classList.remove('open')});document.querySelector('#motionToggle').addEventListener('click',e=>{const on=e.currentTarget.classList.toggle('on');e.currentTarget.setAttribute('aria-pressed',on);let el=document.querySelector('#reduced-motion');if(on){if(!el){el=document.createElement('style');el.id='reduced-motion';el.textContent='*,*:before,*:after{animation:none!important;transition:none!important;scroll-behavior:auto!important}';document.head.appendChild(el)}}else if(el)el.remove()});document.querySelector('#compactToggle').addEventListener('click',()=>showToast('Compact layout will be available after component integration'));


/* Build Fast V3 — isolated client-side demo state; no auth, AI model, payment, or runtime service is connected. */
const defaultAgents = [
  {id:'research',name:'Research Agent',role:'Research',model:'Auto-select (not connected)',instructions:'Investigate requirements and prepare concise specifications.',symbol:'⌕'},
  {id:'design',name:'Design Agent',role:'Design',model:'Auto-select (not connected)',instructions:'Create UI direction, layout decisions, and component specifications.',symbol:'✎'},
  {id:'builder',name:'Builder Agent',role:'Development',model:'Auto-select (not connected)',instructions:'Implement clean, maintainable code and integration boundaries.',symbol:'⌘'},
  {id:'qa',name:'QA Agent',role:'Testing',model:'Auto-select (not connected)',instructions:'Check accessibility, responsive behavior, tests, and regressions.',symbol:'✓'},
  {id:'router',name:'Router Agent',role:'Orchestration',model:'Auto-select (not connected)',instructions:'Coordinate tasks and route work to the appropriate specialist.',symbol:'⌁'}
];
const defaultWorkflows = [
  {id:'example-landing',name:'Landing page build',description:'Plan, design, implement, and validate a landing page.',agents:['research','design','builder','qa'],isExample:true},
  {id:'example-api',name:'API integration',description:'Coordinate implementation and API checks.',agents:['router','builder','qa'],isExample:true}
];
const safeLoad = (key, fallback) => {try {const v=JSON.parse(localStorage.getItem(key));return Array.isArray(v)?v:fallback;}catch(e){return fallback;}};
let blorpAgents=safeLoad('blorp-v3-agents',defaultAgents);
let blorpWorkflows=safeLoad('blorp-v3-workflows',defaultWorkflows);
let latestBuildPlan=null;
let authMode='signin',previewAccount=null;
let selectedBuilderIds=new Set(blorpAgents.map(a=>a.id));
const esc = (value) => String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const keyId=()=> 'local-'+(typeof crypto!=='undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+'-'+Math.random().toString(36).slice(2));
const persistBuild = () => {try {localStorage.setItem('blorp-v3-agents',JSON.stringify(blorpAgents));localStorage.setItem('blorp-v3-workflows',JSON.stringify(blorpWorkflows));}catch(e){showToast('Local storage unavailable; changes last for this session only');}};
const agentSymbol=(role)=>({Research:'⌕',Design:'✎',Development:'⌘',Testing:'✓',Orchestration:'⌁',Content:'✧',DevOps:'⚙',Custom:'◇'}[role]||'◇');
const describeRole=(role)=>({Research:'Requirements & discovery',Design:'UI/UX and visual concepts',Development:'Code & implementation',Testing:'Tests and quality assurance',Orchestration:'Delegation and routing',Content:'Content and copywriting',DevOps:'Build, release and deployment',Custom:'Custom specialist work'}[role]||'Specialist role');
const agentById = (id) => blorpAgents.find(a=>a.id===id);
function renderAgents(){
 document.getElementById('agentCount').textContent=String(blorpAgents.length).padStart(2,'0');
 document.getElementById('workflowCount').textContent=String(blorpWorkflows.length).padStart(2,'0');
 const holder=document.getElementById('agentGrid');
 holder.innerHTML=blorpAgents.map(a=>`<article class="agent-card"><div class="agent-card-header"><div class="agent-symbol">${esc(agentSymbol(a.role))}</div><div class="agent-card-header-text"><h3>${esc(a.name)}</h3><div class="role-description">${esc(describeRole(a.role))}</div></div><span class="agent-state">● Ready</span></div><div class="agent-facts"><span>◇ ${esc(a.role)}</span><span>▣ ${esc(a.model)}</span></div><div class="agent-guidance">${esc(a.instructions||'No instructions set. Edit to customize this specialist.')}</div><div class="agent-actions"><button type="button" class="btn primary" data-assign-agent="${esc(a.id)}">Assign ↗</button><button type="button" class="btn" data-edit-agent="${esc(a.id)}">Edit</button><button type="button" class="btn" data-remove-agent="${esc(a.id)}" aria-label="Remove ${esc(a.name)}">✕</button></div></article>`).join('')+`<button type="button" class="agent-add" id="addAgentTile"><span class="plus-icon">＋</span><b>Add new agent</b><small>Define a specialized job for your next project.</small></button>`;
 holder.querySelector('#addAgentTile').addEventListener('click',()=>openAgentDialog());
 holder.querySelectorAll('[data-assign-agent]').forEach(el=>el.addEventListener('click',()=>{selectedBuilderIds = new Set([el.dataset.assignAgent]);renderAgentChecks();changeView('builder');document.getElementById('buildPrompt').focus();showToast('Agent assigned to the Build Playground plan')}));
 holder.querySelectorAll('[data-edit-agent]').forEach(el=>el.addEventListener('click',()=>openAgentDialog(el.dataset.editAgent)));
 holder.querySelectorAll('[data-remove-agent]').forEach(el=>el.addEventListener('click',()=>{const agent=agentById(el.dataset.removeAgent);if(!agent||!confirm('Remove '+agent.name+' from your local agent configurations?'))return;blorpAgents=blorpAgents.filter(a=>a.id!==agent.id);selectedBuilderIds.delete(agent.id);blorpWorkflows=blorpWorkflows.map(w=>({...w,agents:w.agents.filter(id=>id!==agent.id)}));persistBuild();renderBuildFast();showToast(agent.name+' removed')}));
}
function dialogShow(id){const el=document.getElementById(id);if(typeof el.showModal==='function')el.showModal();else el.setAttribute('open','');}
function dialogHide(id){const el=document.getElementById(id);if(typeof el.close==='function')el.close();else el.removeAttribute('open');}
function openAgentDialog(id){
 const form=document.getElementById('agentForm');form.reset();const a=id?agentById(id):null;
 document.getElementById('agentDialogTitle').textContent=a?'Edit agent':'Add new agent';document.getElementById('agentEditId').value=a?.id||'';
 if(a){document.getElementById('agentName').value=a.name;document.getElementById('agentRole').value=a.role;document.getElementById('agentModel').value=a.model;document.getElementById('agentInstructions').value=a.instructions||'';}
 dialogShow('agentDialog');document.getElementById('agentName').focus();
}
document.getElementById('newAgentBtn').addEventListener('click',()=>openAgentDialog());
document.getElementById('agentForm').addEventListener('submit',e=>{
 e.preventDefault();const id=document.getElementById('agentEditId').value;
 const agent={id:id||keyId(),name:document.getElementById('agentName').value.trim(),role:document.getElementById('agentRole').value,model:document.getElementById('agentModel').value,instructions:document.getElementById('agentInstructions').value.trim()};
 if(!agent.name)return;
 if(id){blorpAgents=blorpAgents.map(a=>a.id===id?agent:a);}else{blorpAgents.push(agent);selectedBuilderIds.add(agent.id);}
 persistBuild();renderBuildFast();dialogHide('agentDialog');showToast('Agent saved to this browser');
});
function renderAgentChecks(){
 const box=document.getElementById('agentChecklist');selectedBuilderIds=new Set([...selectedBuilderIds].filter(id=>agentById(id)));
 box.innerHTML=blorpAgents.length?blorpAgents.map(a=>`<label class="agent-check"><input type="checkbox" data-agent-check="${esc(a.id)}" ${selectedBuilderIds.has(a.id)?'checked':''}/><span>${esc(a.name)}</span><small>${esc(a.role)}</small></label>`).join(''):'<p class="subtle">Create an agent to build a workflow.</p>';
 box.querySelectorAll('[data-agent-check]').forEach(el=>el.addEventListener('change',()=>{if(el.checked)selectedBuilderIds.add(el.dataset.agentCheck);else selectedBuilderIds.delete(el.dataset.agentCheck);updateSelectedAgentCount();}));
 updateSelectedAgentCount();
}
function updateSelectedAgentCount(){document.getElementById('selectedAgentCount').textContent=selectedBuilderIds.size+' selected';}
function workflowRow(w,showDelete){
 const chips=w.agents.map(id=>agentById(id)).filter(Boolean).map(a=>`<span class="flow-chip">${esc(a.name)}</span>`).join('<span class="flow-arrow">→</span>')||'<span class="subtle">No agents assigned</span>';
 return `<div class="flow-row"><div class="flow-info"><strong>${esc(w.name)}</strong><small>${esc(w.description||'No description')}</small></div><div class="flow-chain">${chips}</div><div class="flow-actions"><span class="flow-status">${w.isExample?'● Example':'● Draft'}</span><button class="btn" type="button" data-use-workflow="${esc(w.id)}">Use ↗</button>${showDelete&&!w.isExample?`<button type="button" class="flow-delete" data-delete-workflow="${esc(w.id)}" aria-label="Delete ${esc(w.name)}">Delete</button>`:''}</div></div>`;
}
function renderWorkflows(){
 const brief=blorpWorkflows.slice(0,3);document.getElementById('multiWorkflowList').innerHTML=brief.length?brief.map(w=>workflowRow(w,false)).join(''):'<div class="workflow-empty">No workflows yet. Create one above.</div>';
 document.getElementById('allWorkflowList').innerHTML=blorpWorkflows.length?blorpWorkflows.map(w=>workflowRow(w,true)).join(''):'<div class="workflow-empty">No workflows yet. Create a pipeline to get started.</div>';
 document.getElementById('workflowTotalTag').textContent=blorpWorkflows.length+' workflows';
 document.querySelectorAll('[data-use-workflow]').forEach(el=>el.addEventListener('click',()=>{const w=blorpWorkflows.find(w=>w.id===el.dataset.useWorkflow);if(!w)return;selectedBuilderIds=new Set(w.agents.filter(id=>agentById(id)));renderAgentChecks();changeView('builder');showToast(w.name+' loaded into Build Playground')}));
 document.querySelectorAll('[data-delete-workflow]').forEach(el=>el.addEventListener('click',()=>{const w=blorpWorkflows.find(w=>w.id===el.dataset.deleteWorkflow);if(!w||w.isExample||!confirm('Delete your workflow draft "'+w.name+'"?'))return;blorpWorkflows=blorpWorkflows.filter(t=>t.id!==w.id);persistBuild();renderBuildFast();showToast('Workflow draft deleted')}));
}
function renderBuildFast(){renderAgents();renderAgentChecks();renderWorkflows();}
renderBuildFast();
const setupWorkflowModal=()=>{
 document.getElementById('workflowForm').reset();
 document.getElementById('workflowAgentChecks').innerHTML=blorpAgents.length?blorpAgents.map(a=>`<label><input type="checkbox" data-workflow-agent="${esc(a.id)}" ${selectedBuilderIds.has(a.id)?'checked':''}/> ${esc(a.name)} <small style="color:#807b99">· ${esc(a.role)}</small></label>`).join(''):'<p class="subtle">Add an agent before creating a workflow.</p>';
 dialogShow('workflowDialog');
};
['newWorkflowBtn','newWorkflowFromPage'].forEach(id=>document.getElementById(id).addEventListener('click',setupWorkflowModal));
document.getElementById('workflowForm').addEventListener('submit',e=>{
 e.preventDefault();const ids=[...document.querySelectorAll('#workflowAgentChecks input:checked')].map(el=>el.dataset.workflowAgent);
 if(!ids.length){showToast('Select at least one agent');return;}
 blorpWorkflows.push({id:keyId(),name:document.getElementById('workflowName').value.trim(),description:document.getElementById('workflowDescription').value.trim()||'Custom build pipeline',agents:ids,isExample:false});persistBuild();renderBuildFast();dialogHide('workflowDialog');changeView('workflows');showToast('Workflow draft created');
});
document.querySelectorAll('[data-close-dialog]').forEach(el=>el.addEventListener('click',()=>dialogHide(el.dataset.closeDialog)));
document.querySelectorAll('.blorp-modal').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)dialogHide(el.id);}));

const templateProjects={landing:{type:'Website',stack:'React + Vite + Tailwind',brief:'Build an elegant responsive SaaS landing page with clear product storytelling, a smooth hero reveal, feature sections, pricing presentation, FAQ, accessible navigation, and a strong call to action.'},dashboard:{type:'Dashboard',stack:'React + Vite + Tailwind',brief:'Build a premium admin dashboard with role-based navigation, analytics cards, searchable data tables, clear status indicators, responsive layouts, and accessible form states.'},api:{type:'API',stack:'Node.js + Express',brief:'Design and implement a secure REST API with account authentication, role checks, input validation, CRUD endpoints, tests, configuration management, and clear setup documentation.'}};
document.querySelectorAll('[data-template]').forEach(el=>el.addEventListener('click',()=>{const t=templateProjects[el.dataset.template];document.getElementById('buildType').value=t.type;document.getElementById('buildStack').value=t.stack;document.getElementById('buildPrompt').value=t.brief;updatePromptCounter();document.getElementById('buildPrompt').focus();showToast('Starting template loaded')}));
function updatePromptCounter(){const v=document.getElementById('buildPrompt').value;document.getElementById('promptCounter').textContent=v.length+' / 4000';}
document.getElementById('buildPrompt').addEventListener('input',updatePromptCounter);
const rolePlan={Research:'Capture requirements, dependencies, and acceptance criteria.',Design:'Propose the page structure, components, responsive behavior, and visual system.',Development:'Scaffold the application and implement reviewed features in small, testable steps.',Testing:'Run functional, accessibility, performance, and responsive QA checks.',Orchestration:'Break work into bounded tasks, set handoff order, and track progress.',Content:'Draft concise, purposeful copy and improve the information hierarchy.',DevOps:'Prepare reproducible builds, environment configuration, deployment, and rollback.',Custom:'Deliver the scoped work outlined in the agent instructions.'};
function planAsText(p){return `BLORP BUILD FAST — LOCAL PREVIEW PLAN\n\nProject: ${p.type}\nStack: ${p.stack}\n\nBrief:\n${p.brief}\n\nAgent pipeline:\n${p.steps.map((step,i)=>`${i+1}. ${step.name} (${step.role}) — ${step.task}`).join('\n')}\n\nHandoff checks:\n- Review scope before implementation\n- Validate output and tests before release\n- Do not run agent code without approval and sandboxing\n\nPreview only. No agents were executed.`;}
function prepareBuildPlan(){
 const brief=document.getElementById('buildPrompt').value.trim();const type=document.getElementById('buildType').value;const stack=document.getElementById('buildStack').value;
 const agents=blorpAgents.filter(a=>selectedBuilderIds.has(a.id));
 if(!brief){document.getElementById('buildPrompt').focus();showToast('Write a brief to plan your build');return;}
 if(!agents.length){showToast('Select at least one agent to continue');return;}
 latestBuildPlan={type,stack,brief,createdAt:new Date().toISOString(),steps:agents.map(a=>({agentId:a.id,name:a.name,role:a.role,task:a.instructions||rolePlan[a.role]||rolePlan.Custom})),preview:true};
 document.getElementById('buildOutput').innerHTML=`<div class="out-heading"><strong>${esc(type)}</strong> · ${esc(stack)}<br/><span style="color:#89829f">${agents.length} specialist${agents.length===1?'':'s'} assigned · Demo plan</span></div>`+latestBuildPlan.steps.map((step,i)=>`<div class="out-item"><span class="out-num">${i+1}</span><div><b>${esc(step.name)}</b><p>${esc(step.task)}</p></div></div>`).join('')+'<p class="form-hint">Planning only. Real code generation needs a configured agent backend.</p>';
 document.getElementById('buildOutputActions').hidden=false;showToast('Build plan prepared locally');
}
document.getElementById('preparePlanBtn').addEventListener('click',prepareBuildPlan);
document.getElementById('copyPlanBtn').addEventListener('click',async()=>{
 if(!latestBuildPlan)return;const content=planAsText(latestBuildPlan);
 try{await navigator.clipboard.writeText(content);showToast('Plan copied');}catch(e){showToast('Clipboard blocked by browser: use Export JSON');}
});
document.getElementById('exportPlanBtn').addEventListener('click',()=>{
 if(!latestBuildPlan)return;const blob=new Blob([JSON.stringify(latestBuildPlan,null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='blorp-build-plan.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);showToast('Build plan exported as JSON');
});
document.getElementById('saveWorkflowBtn').addEventListener('click',()=>{
 if(!latestBuildPlan)return;
 blorpWorkflows.push({id:keyId(),name:latestBuildPlan.type+' build · '+new Date().toLocaleDateString(),description:latestBuildPlan.brief.slice(0,115),agents:latestBuildPlan.steps.map(step=>step.agentId),isExample:false});persistBuild();renderBuildFast();changeView('workflows');showToast('Build plan saved as workflow draft');
});

// Auth is a clearly labelled UI-only preview. Password input is never persisted or submitted.
function setAuthMode(next){authMode=next;const isSignUp=next==='signup';document.getElementById('authTitle').textContent=isSignUp?'Create an account':'Sign in';document.getElementById('authNameWrap').hidden=!isSignUp;document.getElementById('authName').required=isSignUp;document.getElementById('authPassword').autocomplete=isSignUp?'new-password':'current-password';document.getElementById('authSignInTab').classList.toggle('selected',!isSignUp);document.getElementById('authSignUpTab').classList.toggle('selected',isSignUp);document.getElementById('authSignInTab').setAttribute('aria-pressed',String(!isSignUp));document.getElementById('authSignUpTab').setAttribute('aria-pressed',String(isSignUp));document.getElementById('authSubmit').textContent=isSignUp?'Sign up':'Sign in';}
function openAuth(mode){document.getElementById('authForm').reset();setAuthMode(mode);dialogShow('authDialog');document.getElementById('authEmail').focus();}
document.getElementById('signInBtn').addEventListener('click',()=>openAuth('signin'));
document.getElementById('signUpBtn').addEventListener('click',()=>openAuth('signup'));
document.getElementById('authSignInTab').addEventListener('click',()=>setAuthMode('signin'));
document.getElementById('authSignUpTab').addEventListener('click',()=>setAuthMode('signup'));
function renderPreviewAuth(){document.getElementById('guestAuth').hidden=!!previewAccount;document.getElementById('demoAuth').hidden=!previewAccount;if(previewAccount){document.getElementById('accountEmail').textContent=previewAccount.email;document.getElementById('accountAvatar').textContent=previewAccount.name.slice(0,1).toUpperCase()||'B';}}
document.getElementById('authForm').addEventListener('submit',async e=>{
 e.preventDefault();const email=document.getElementById('authEmail').value.trim();const password=document.getElementById('authPassword').value;
 const name=authMode==='signup'?document.getElementById('authName').value.trim():'';
 if(!email||!password)return;
 if(location.protocol==='file:'){showToast('Start the Blorp local server to use real sign-in');return;}
 const submit=document.getElementById('authSubmit');submit.disabled=true;submit.textContent='Checking account…';
 try{const r=await fetch('/api/auth/'+(authMode==='signup'?'signup':'signin'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,name})});const body=await r.json();if(!r.ok)throw Error(body.error||'Sign in failed');previewAccount=body.user;renderPreviewAuth();dialogHide('authDialog');document.getElementById('authPassword').value='';window.dispatchEvent(new CustomEvent('blorp:authchange',{detail:body.user}));showToast('Signed in to local Blorp');}catch(err){showToast(err.message)}finally{submit.disabled=false;submit.textContent=authMode==='signup'?'Sign up':'Sign in'}
});
document.getElementById('signOutBtn').addEventListener('click',async()=>{try{await fetch('/api/auth/signout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});}catch(e){}previewAccount=null;renderPreviewAuth();window.dispatchEvent(new CustomEvent('blorp:authchange',{detail:null}));showToast('Signed out');});
renderPreviewAuth();

/* Auto visual quality is a heuristic, not a hardware benchmark. */
(function initVisualQuality(){
  const buttons=Array.from(document.querySelectorAll('[data-fx]'));
  const label=document.getElementById('visualLabel');
  const tag=document.getElementById('performanceTag');
  const explanation=document.getElementById('fxReason');
  const media=window.matchMedia('(prefers-reduced-motion: reduce)');
  const modes={cinematic:'Cinematic',balanced:'Balanced',lite:'Lite'};
  function computeAuto(){
    const threads=Number(navigator.hardwareConcurrency)||0;
    const memory=Number(navigator.deviceMemory)||0;
    const saveData=!!(navigator.connection&&navigator.connection.saveData);
    const limited=media.matches||saveData||(threads&&threads<=4)||(memory&&memory<=4)||window.innerWidth<800;
    return limited?'lite':'balanced';
  }
  let preference='auto';
  try {const saved=localStorage.getItem('blorp-v2-fx');if(['auto','cinematic','balanced','lite'].includes(saved))preference=saved;}catch(e){}
  function applyEffects(){
    const effective=preference==='auto'?computeAuto():preference;
    document.body.classList.remove('fx-cinematic','fx-balanced','fx-lite');
    document.body.classList.add('fx-'+effective);
    buttons.forEach(button=>{const chosen=button.dataset.fx===preference;button.classList.toggle('is-selected',chosen);button.setAttribute('aria-pressed',String(chosen));});
    label.textContent=preference==='auto'?'Auto · '+modes[effective]:modes[effective];
    tag.textContent=modes[effective]+' effects';
    explanation.textContent=preference==='auto'
      ?'Auto is using '+modes[effective].toLowerCase()+' effects based on device and display hints. This is an estimate, not a performance benchmark.'
      :modes[effective]+' visuals selected manually. You can switch back to Auto at any time.';
  }
  buttons.forEach(button=>button.addEventListener('click',()=>{
    preference=button.dataset.fx;
    try{localStorage.setItem('blorp-v2-fx',preference);}catch(e){}
    applyEffects();
  }));
  if(media.addEventListener)media.addEventListener('change',()=>{if(preference==='auto')applyEffects()});
  let wasSmall=window.innerWidth<800;window.addEventListener('resize',()=>{const isSmall=window.innerWidth<800;if(preference==='auto'&&isSmall!==wasSmall)applyEffects();wasSmall=isSmall;});
  applyEffects();
})();



/* Blorp V4.1 chat-first UI controls. These customize the existing local planner, not AI inference. */
(function initChatFirstBuilder(){
 const ids=id=>document.getElementById(id);
 const projectStorage='blorp-v41-projects';
 const modelStorage='blorp-v41-model';
 let projects;
 try{projects=JSON.parse(localStorage.getItem(projectStorage));}catch(e){projects=null;}
 if(!Array.isArray(projects)||!projects.length)projects=[{id:'starter',name:'Untitled project',messages:[],brief:'',type:'Website',stack:'React + Vite + Tailwind',model:'Blorp V3'}];
 projects=projects.filter(p=>p&&typeof p.id==='string'&&typeof p.name==='string').slice(0,50);
 if(!projects.length)projects=[{id:'starter',name:'Untitled project',messages:[],brief:'',type:'Website',stack:'React + Vite + Tailwind',model:'Blorp V3'}];
 let activeProjectId;try{activeProjectId=localStorage.getItem('blorp-v41-active-project');}catch(e){}
 if(!projects.some(p=>p.id===activeProjectId))activeProjectId=projects[0].id;
 const modelInfo=[['Blorp V1','Light · lowest planned compute'],['Blorp V2','Fast · efficient planning'],['Blorp V3','Balanced · advanced build assistant'],['Blorp V4','Power · more planned reasoning compute'],['Blorp V5','Max · highest planned compute']];
 function current(){return projects.find(p=>p.id===activeProjectId)||projects[0]}
 function save(){try{localStorage.setItem(projectStorage,JSON.stringify(projects));localStorage.setItem('blorp-v41-active-project',activeProjectId);}catch(e){/* Browsers may restrict local-file storage; keep the in-memory project state. */}}
 function setModel(value){if(!modelInfo.some(m=>m[0]===value))return;current().model=value;ids('activeModelName').textContent=value;ids('composerModelName').textContent=value;save();renderModels();}
 function renderModels(){ids('buildModelOptions').innerHTML=modelInfo.map(([name,desc],i)=>`<button class="build-model-option ${current().model===name?'active':''}" type="button" data-choose-model="${name}" aria-pressed="${current().model===name}"><span class="build-model-icon">V${i+1}</span><span class="build-model-copy"><strong>${name}</strong><small>${desc}</small></span><span>${current().model===name?'✓':''}</span></button>`).join('');ids('buildModelOptions').querySelectorAll('[data-choose-model]').forEach(btn=>btn.addEventListener('click',()=>{setModel(btn.dataset.chooseModel);dialogHide('buildModelDialog');showToast(btn.dataset.chooseModel+' selected (preview)')}));}
 function renderProjects(){ids('buildProjectList').innerHTML=projects.map(p=>`<button type="button" class="build-project-option ${p.id===activeProjectId?'active':''}" data-project-id="${esc(p.id)}"><span>▣</span><div><strong>${esc(p.name)}</strong><small>${(p.messages||[]).length} chat messages · ${esc(p.type||'Website')}</small></div>${p.id===activeProjectId?'<b>✓</b>':''}</button>`).join('');ids('buildProjectList').querySelectorAll('[data-project-id]').forEach(btn=>btn.addEventListener('click',()=>{selectProject(btn.dataset.projectId);dialogHide('buildProjectDialog')}));}
 function messageElement(m){const article=document.createElement('article');article.className='build-chat-msg '+(m.role==='user'?'user':'assistant');const avatar=document.createElement('span');avatar.className='build-chat-avatar';avatar.textContent=m.role==='user'?'Y':'b';const body=document.createElement('div');body.className='build-message-bubble';if(m.role==='assistant'){
  const lead=document.createElement('strong');lead.textContent='Blorp · local planning preview';body.append(lead);
  const p=document.createElement('p');p.textContent=m.content;body.append(p);
  if(m.isPlan){const b=document.createElement('button');b.type='button';b.className='build-plan-link';b.textContent='◫ View latest execution plan';b.addEventListener('click',openOutput);body.append(b)}
 }else{body.textContent=m.content}article.append(avatar,body);return article;}
 function renderThread(){const messages=Array.isArray(current().messages)?current().messages:[];ids('buildWelcome').hidden=messages.length>0;ids('buildThread').replaceChildren(...messages.map(messageElement));ids('buildConversationScroll').scrollTop=ids('buildConversationScroll').scrollHeight;}
 function restorePlan(plan){
  latestBuildPlan=plan||null;
  if(!plan){ids('buildOutput').innerHTML='<div class="output-empty"><span class="output-icon">✧</span><h3>Nothing built yet</h3><p>Send a message to prepare a local build plan. Your selected agents will appear here.</p></div>';ids('buildOutputActions').hidden=true;return;}
  ids('buildOutput').innerHTML=`<div class="out-heading"><strong>${esc(plan.type)}</strong> · ${esc(plan.stack)}<br/><span style="color:#94b1ab">${plan.steps.length} specialists · Local demo plan</span></div>`+plan.steps.map((step,i)=>`<div class="out-item"><span class="out-num">${i+1}</span><div><b>${esc(step.name)}</b><p>${esc(step.task)}</p></div></div>`).join('')+'<p class="form-hint">Planning preview only — real code generation requires backend integration.</p>';
  ids('buildOutputActions').hidden=false;
 }
 function selectProject(id){const p=projects.find(p=>p.id===id);if(!p)return;activeProjectId=id;ids('activeProjectName').textContent=p.name;ids('buildType').value=p.type||'Website';ids('buildStack').value=p.stack||'React + Vite + Tailwind';ids('buildPrompt').value=p.brief||'';ids('promptCounter').textContent=ids('buildPrompt').value.length+' / 4000';setModel(p.model||'Blorp V3');restorePlan(p.plan);renderThread();save();closeOutput();}
 function openOutput(){ids('buildOutputDrawer').hidden=false;ids('outputPanelToggle').setAttribute('aria-expanded','true')}
 function closeOutput(){ids('buildOutputDrawer').hidden=true;ids('outputPanelToggle').setAttribute('aria-expanded','false')}
 ids('buildSetupOpenBtn').addEventListener('click',()=>dialogShow('buildSetupDialog'));
 ids('composeSetupBtn').addEventListener('click',()=>dialogShow('buildSetupDialog'));
 ids('composerAddBtn').addEventListener('click',()=>dialogShow('buildSetupDialog'));
 ids('manageBuildAgents').addEventListener('click',()=>dialogHide('buildSetupDialog'));
 ids('saveBuildSetupBtn').addEventListener('click',()=>{current().type=ids('buildType').value;current().stack=ids('buildStack').value;save();dialogHide('buildSetupDialog');showToast('Project settings updated')});
 ids('buildModelPickerBtn').addEventListener('click',()=>{renderModels();dialogShow('buildModelDialog')});
 ids('composeModelBtn').addEventListener('click',()=>{renderModels();dialogShow('buildModelDialog')});
 ids('projectPickerBtn').addEventListener('click',()=>{renderProjects();dialogShow('buildProjectDialog')});
 ids('outputPanelToggle').addEventListener('click',()=>ids('buildOutputDrawer').hidden?openOutput():closeOutput());
 ids('closeBuildOutput').addEventListener('click',closeOutput);
 ids('createBuildProjectForm').addEventListener('submit',e=>{e.preventDefault();const name=ids('newBuildProjectName').value.trim();if(!name)return;const p={id:keyId(),name,messages:[],brief:'',type:'Website',stack:'React + Vite + Tailwind',model:current().model};projects.unshift(p);if(projects.length>50)projects.pop();selectProject(p.id);ids('newBuildProjectName').value='';dialogHide('buildProjectDialog');showToast('Created local project: '+name)});
 document.querySelectorAll('#buildSetupDialog .dialog-close,#buildModelDialog .dialog-close,#buildProjectDialog .dialog-close').forEach(btn=>btn.addEventListener('click',()=>dialogHide(btn.closest('dialog').id)));
 ['buildSetupDialog','buildModelDialog','buildProjectDialog'].forEach(id=>ids(id).addEventListener('click',e=>{if(e.target===ids(id))dialogHide(id)}));
 // A template may update the underlying project settings, but it must not submit a fake AI request.
 document.querySelectorAll('#builder [data-template]').forEach(btn=>btn.addEventListener('click',()=>{current().type=ids('buildType').value;current().stack=ids('buildStack').value;current().brief=ids('buildPrompt').value;save();}));
 ids('buildPrompt').addEventListener('input',()=>{current().brief=ids('buildPrompt').value;save()});
 ids('buildPrompt').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();ids('preparePlanBtn').click()}});
 // This listener runs after the original local plan generator, retaining its existing Copy/Export/Save logic.
 ids('preparePlanBtn').addEventListener('click',()=>{
  const p=current();const plan=latestBuildPlan;
  if(!plan||!plan.brief.trim()||plan.brief.trim()!==ids('buildPrompt').value.trim())return;
  if(!Array.isArray(p.messages))p.messages=[];
  p.messages.push({role:'user',content:plan.brief});
  const chain=plan.steps.map(s=>s.name.replace(/ Agent$/,'')).join(' → ');
  p.messages.push({role:'assistant',isPlan:true,content:`I've prepared an editable build outline for your ${plan.type.toLowerCase()} using ${plan.stack}.\n\nAgent chain: ${chain}.\n\nThis is a local preview plan, not an actual website build. Open Build output to inspect tasks, copy the plan, or save it as a workflow.`});
  p.messages=p.messages.slice(-80);p.brief='';p.type=plan.type;p.stack=plan.stack;p.model=ids('activeModelName').textContent;p.plan=plan;save();
  ids('buildPrompt').value='';ids('promptCounter').textContent='0 / 4000';renderThread();
 });
 // Model + project selection can live independently from the busy agent editor.
 selectProject(activeProjectId);
 window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!ids('buildOutputDrawer').hidden)closeOutput()});
})();

