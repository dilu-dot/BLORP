/* Blorp V5 Foundation: UI enhancements and local-dev API session. No remote model calls or billing. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const addons=[
  {id:'github',name:'GitHub',category:'Development',icon:'⌘',desc:'Repository context, pull requests, and code collaboration.'},
  {id:'vercel',name:'Vercel',category:'Development',icon:'▲',desc:'Preview, inspect, and deploy websites with review gates.'},
  {id:'figma',name:'Figma',category:'Design',icon:'◩',desc:'Connect design files and UI components to build tasks.'},
  {id:'supabase',name:'Supabase',category:'Development',icon:'◈',desc:'Databases, authentication, storage, and backend services.'},
  {id:'notion',name:'Notion',category:'Productivity',icon:'▤',desc:'Product documentation, specs, and project notes.'},
  {id:'drive',name:'Google Drive',category:'Productivity',icon:'△',desc:'Browse and use project documents and assets.'},
  {id:'browser',name:'Web Browser',category:'Research',icon:'◎',desc:'Web research and testing through approved browser tools.'},
  {id:'terminal',name:'Developer Terminal',category:'Development',icon:'>_',desc:'Sandboxed commands, builds, and automated tests.'},
  {id:'mcp',name:'Custom MCP',category:'Development',icon:'✣',desc:'Register approved Model Context Protocol tools.'},
 ];
 const skills=[
  {id:'frontend',name:'Premium Frontend',icon:'✦',desc:'Component systems, typography, responsive layouts, and subtle animation.'},
  {id:'backend',name:'Backend Architect',icon:'⌘',desc:'APIs, databases, auth boundaries, and clean architecture.'},
  {id:'testing',name:'QA & Accessibility',icon:'✓',desc:'Regression checks, keyboard navigation, and responsive QA.'},
  {id:'security',name:'Security Review',icon:'◇',desc:'Permission reviews, secret hygiene, and secure-by-default flows.'},
  {id:'deploy',name:'Deployment Expert',icon:'▲',desc:'Build pipelines, preview validation, and safe releases.'},
  {id:'performance',name:'Performance Lab',icon:'ϟ',desc:'Load time, memory budgets, and adaptive visual quality.'}
 ];
 const load=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch(e){return fallback}};
 const save=(key,content)=>{try{localStorage.setItem(key,JSON.stringify(content));}catch(e){showToast('Browser storage is unavailable')}};
 let prefs=load('blorp-v5-addons',{});if(!prefs||typeof prefs!=='object'||Array.isArray(prefs))prefs={};
 let savedSkills=load('blorp-v5-skills',{});if(!savedSkills||typeof savedSkills!=='object')savedSkills={};
 let custom=load('blorp-v5-mcp',[]);if(!Array.isArray(custom))custom=[];
 let tab='discover',category='All',term='';
 const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const all=()=>addons.concat(custom.map((c,i)=>({id:'user-'+i,name:c.name,category:'Development',icon:'✣',desc:'Local MCP integration draft · Not connected'})));
 const activePref=id=>prefs[id]&&prefs[id].enabled;
 function addonCard(a){return `<article class="addon-card"><div class="addon-card-top"><span class="addon-logo">${a.icon}</span><div><div class="addon-name">${safe(a.name)}</div><div class="addon-category">${safe(a.category)} · ${a.id==='mcp'?'Protocol':'Integration'}</div></div></div><p class="addon-desc">${safe(a.desc)}</p><div class="addon-card-bottom"><span class="addon-status ${activePref(a.id)?'on':''}">${activePref(a.id)?'● Preview enabled':'○ Not configured'}</span><button type="button" class="btn" data-config-addon="${safe(a.id)}">${activePref(a.id)?'Manage':'Configure'}</button></div></article>`}
 function bindAddons(root){root.querySelectorAll('[data-config-addon]').forEach(b=>b.addEventListener('click',()=>openAddon(b.dataset.configAddon)))}
 function renderAddons(){
  const q=term.trim().toLowerCase();
  const filtered=all().filter(a=>(category==='All'||a.category===category)&&(a.name+' '+a.desc+' '+a.category).toLowerCase().includes(q));
  const discover=$('addonGrid');discover.innerHTML=filtered.map(addonCard).join('')||'<div class="v5-empty">No matching add-ons found.</div>';bindAddons(discover);
  const installed=all().filter(a=>activePref(a.id)&&(a.name+' '+a.desc).toLowerCase().includes(q));$('addonInstalled').innerHTML=installed.map(addonCard).join('')||'<div class="v5-empty">No preview add-ons enabled yet. Discover one to configure its permissions.</div>';bindAddons($('addonInstalled'));
  $('skillGrid').innerHTML=skills.filter(s=>(s.name+' '+s.desc).toLowerCase().includes(q)).map(s=>`<article class="addon-card"><div class="addon-card-top"><span class="addon-logo">${s.icon}</span><div><div class="addon-name">${safe(s.name)}</div><div class="addon-category">Blorp skill · Draft</div></div></div><p class="addon-desc">${safe(s.desc)}</p><div class="addon-card-bottom"><span class="addon-status ${savedSkills[s.id]?'on':''}">${savedSkills[s.id]?'● Enabled in preview':'○ Disabled'}</span><button type="button" class="btn" data-skill="${s.id}">${savedSkills[s.id]?'Disable':'Enable'}</button></div></article>`).join('')||'<div class="v5-empty">No matching skills.</div>';
  $('skillGrid').querySelectorAll('[data-skill]').forEach(b=>b.addEventListener('click',()=>{savedSkills[b.dataset.skill]=!savedSkills[b.dataset.skill];save('blorp-v5-skills',savedSkills);renderAddons();showToast('Skill preference saved locally · no agent runtime connected')}));
 }
 function renderFilters(){const labels=['All','Development','Design','Productivity','Research'];$('addonFilters').innerHTML=labels.map(c=>`<button type="button" data-category="${c}" class="${category===c?'selected':''}">${c}</button>`).join('');$('addonFilters').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{category=b.dataset.category;renderFilters();renderAddons()}))}
 function openAddon(id){const a=all().find(x=>x.id===id);if(!a)return;$('addonId').value=id;$('addonDialogTitle').textContent=a.name+' permissions';$('addonDialogDesc').textContent='Who may request '+a.name+'? This is a configuration preview only.';const x=prefs[id]||{};document.querySelectorAll('#addonForm [name="addonRole"]').forEach(input=>input.checked=(x.roles||['Research','Design','Builder','QA']).includes(input.value));$('addonAskBefore').checked=x.askBefore!==false;dialogShow('addonDialog')}
 $('addonForm').addEventListener('submit',e=>{e.preventDefault();const id=$('addonId').value;prefs[id]={enabled:true,roles:Array.from(document.querySelectorAll('#addonForm [name="addonRole"]:checked')).map(x=>x.value),askBefore:$('addonAskBefore').checked};save('blorp-v5-addons',prefs);dialogHide('addonDialog');renderAddons();showToast('Configuration saved locally · connection not active')});
 $('addonDisable').addEventListener('click',()=>{const id=$('addonId').value;if(prefs[id])prefs[id].enabled=false;save('blorp-v5-addons',prefs);dialogHide('addonDialog');renderAddons();showToast('Preview add-on disabled')});
 $('customMcpBtn').addEventListener('click',()=>dialogShow('mcpDialog'));
 $('mcpForm').addEventListener('submit',e=>{e.preventDefault();const name=$('mcpName').value.trim(),address=$('mcpAddress').value.trim();let u;try{u=new URL(address);if(!['https:','http:'].includes(u.protocol))throw Error('protocol');}catch(e){showToast('Enter a valid HTTP(S) server URL');return}if(!name)return;custom.push({name:name.slice(0,55),url:address.slice(0,300)});custom=custom.slice(-20);save('blorp-v5-mcp',custom);dialogHide('mcpDialog');$('mcpForm').reset();renderAddons();showToast('MCP draft saved · server was not contacted')});
 document.querySelectorAll('#addonDialog .dialog-close,#mcpDialog .dialog-close').forEach(b=>b.addEventListener('click',()=>dialogHide(b.closest('dialog').id)));
 ['addonDialog','mcpDialog'].forEach(id=>$(id).addEventListener('click',e=>{if(e.target===$(id))dialogHide(id)}));
 document.querySelectorAll('[data-addontab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.addontab;document.querySelectorAll('[data-addontab]').forEach(x=>x.classList.toggle('selected',x===b));$('addonsDiscover').hidden=tab!=='discover';$('addonsMine').hidden=tab!=='mine';$('addonsSkills').hidden=tab!=='skills';renderAddons()}));
 $('addonSearch').addEventListener('input',e=>{term=e.target.value;renderAddons()});renderFilters();renderAddons();
 // Prices are only an informational design; no client-side upgrades or billing state changes.
 document.querySelectorAll('[data-billing]').forEach(b=>b.addEventListener('click',()=>{const annual=b.dataset.billing==='annual';document.querySelectorAll('[data-billing]').forEach(x=>x.classList.toggle('selected',x===b));$('builderPrice').textContent=annual?'$18':'$20';$('studioPrice').textContent=annual?'$45':'$50';$('builderBilled').textContent=annual?'$216 billed annually (10% off)':'$20 billed monthly';$('studioBilled').textContent=annual?'$540 billed annually (10% off)':'$50 billed monthly'}));
 $('builderPlanBtn').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('blorp:selectplan',{detail:'builder'})));$('studioPlanBtn').addEventListener('click',()=>window.dispatchEvent(new CustomEvent('blorp:selectplan',{detail:'studio'})));
 function getDrafts(){try{const d=JSON.parse(localStorage.getItem('blorp-v41-projects'));return Array.isArray(d)?d.filter(p=>p&&typeof p.name==='string').slice(0,50):[]}catch(e){return []}}
 function renderProjects(){const p=getDrafts();$('v5ProjectsMetric').textContent=String(p.length);$('v5RecentProjects').innerHTML=p.slice(0,4).map(x=>`<button type="button" class="v5-recent-item" data-open-draft><span><strong>${safe(x.name)}</strong><small>${safe(x.stack||'React + Vite + Tailwind')} · ${(x.messages||[]).length} messages</small></span><span>↗</span></button>`).join('')||'<div class="v5-empty">No drafts yet. Start with a new project.</div>';
 $('v5ProjectsList').innerHTML=p.map(x=>`<article class="v5-project-tile"><div class="v5-project-art">▣</div><h3>${safe(x.name)}</h3><p>${safe(x.type||'Website')} · ${safe(x.stack||'React + Vite + Tailwind')}<br/>${(x.messages||[]).length} messages · ${safe(x.model||'Blorp V3')}</p><button type="button" class="btn" data-open-draft>Open in Build Playground →</button></article>`).join('')||'<div class="v5-empty">You have no project drafts yet.</div>';
 document.querySelectorAll('[data-open-draft]').forEach(b=>b.addEventListener('click',()=>{changeView('builder');$('projectPickerBtn').click()}));
 }
 $('v5NewProject').addEventListener('click',()=>{changeView('builder');$('projectPickerBtn').click()});
 async function requestJSON(path,body){const resp=await fetch(path,{method:body?'POST':'GET',credentials:'same-origin',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const value=await resp.json();if(!resp.ok)throw Error(value.error||'Request failed');return value;}
 $('v5BackupProjects').addEventListener('click',async()=>{
  if(!account){showToast('Sign in to back up project drafts');return;}
  const drafts=getDrafts();if(!drafts.length){showToast('No project drafts to back up');return;}
  let success=0;try{for(const p of drafts){const payload={id:p.id,name:p.name,type:p.type,stack:p.stack,model:p.model,brief:String(p.brief||'').slice(0,1800),messages:(p.messages||[]).slice(-12),plan:p.plan||null};await requestJSON('/api/projects',{id:p.id,title:p.name,payload});success++;}showToast('Backed up '+success+' local project drafts to your account');}catch(e){showToast('Saved '+success+' projects; '+e.message)}
 });
 $('v5RestoreProjects').addEventListener('click',async()=>{
  if(!account){showToast('Sign in to restore project drafts');return;}
  try{const remote=(await requestJSON('/api/projects')).projects||[];if(!remote.length){showToast('No backed-up projects found');return;}const existing=getDrafts();const ids=new Set(existing.map(p=>p.id));let added=0;for(const r of remote){if(!r.payload||typeof r.payload!=='object'||ids.has(r.id))continue;existing.push({...r.payload,id:r.id,name:r.title});ids.add(r.id);added++;}if(!added){showToast('All backed-up projects are already present');return;}save('blorp-v41-projects',existing.slice(0,50));showToast('Restored '+added+' projects; refreshing the workspace');setTimeout(()=>location.reload(),600);}catch(e){showToast('Restore failed: '+e.message)}
 });
 // Local Python backend only. On file://, show the UI but do not simulate authentication.
 let account=null;
 function renderAccount(user){account=user;const a=user?user.name||user.email.split('@')[0]:'Your creator';$('v5Hello').textContent=user?'Welcome back, '+a+'.':'Your creator dashboard';$('v5AccountLead').textContent=user?'Your local workspace is ready. Build confidently.':'Sign in to get your local profile and free credit allocation.';const plan=user?user.plan||'free':'free';$('v5AccountPlan').textContent=plan.toUpperCase()+' PLAN';$('memberCurrentPlan').textContent='CURRENT · '+plan.toUpperCase();$('v5PlanMetric').textContent=plan.slice(0,1).toUpperCase()+plan.slice(1);$('v5CreditsMetric').textContent=user?Number(user.credits_remaining||0).toLocaleString('en-US'):'—';$('v5BuildAccess').textContent=user&&user.build_fast_unlocked?'Unlocked':'Locked';$('v5ProfileEmail').textContent=user?user.email:'Not signed in';$('v5ProfilePlan').textContent=plan.slice(0,1).toUpperCase()+plan.slice(1);$('v5ProfileRuns').textContent='No runtime connected'}
 window.addEventListener('blorp:authchange',e=>renderAccount(e.detail));renderAccount(null);
 async function restoreAccount(){if(location.protocol==='file:'||location.protocol==='blorp:')return;try{const r=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!r.ok)return;const data=await r.json();if(data.user){previewAccount=data.user;renderPreviewAuth();renderAccount(data.user);window.dispatchEvent(new CustomEvent('blorp:authchange',{detail:data.user}))}}catch(e){/* server offline: leave guest UI */}}
 restoreAccount();
 // Chat/Build/Autopilot. Build and Autopilot never execute hidden operations.
 document.querySelectorAll('[data-ai-mode]').forEach(b=>b.addEventListener('click',()=>{const m=b.dataset.aiMode;if(m==='build'){changeView('builder');return}if(m==='autopilot'){showToast('Autopilot execution is planned; no agents have terminal access yet');return}document.querySelectorAll('[data-ai-mode]').forEach(x=>x.classList.toggle('on',x===b))}));
 $('aiToolsBtn').addEventListener('click',()=>changeView('addons'));
 $('aiModel').addEventListener('change',e=>showToast(e.target.value+' selected · no inference connected'));
 // Keep project counts fresh when opening dashboard and projects after using the existing builder.
 const nav=Array.from(document.querySelectorAll('[data-view]'));nav.filter(b=>['account','projects'].includes(b.dataset.view)).forEach(b=>b.addEventListener('click',()=>renderProjects()));
 document.querySelectorAll('[data-open="projects"]').forEach(b=>b.addEventListener('click',()=>renderProjects()));
 renderProjects();
})();
