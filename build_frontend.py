from pathlib import Path
import re

ROOT=Path(__file__).resolve().parent
src=(ROOT/'legacy-source-v41.html').read_text(encoding='utf-8')
css=re.search(r'<style>(.*?)</style>',src,re.S).group(1)
js=re.search(r'<script>(.*?)</script>',src,re.S).group(1)
html=re.sub(r'<style>.*?</style>', '<link rel="stylesheet" href="/assets/base.css"/>\n<link rel="stylesheet" href="/assets/v5.css"/>',src,flags=re.S,count=1)
html=re.sub(r'<script>.*?</script>', '<script src="/assets/base.js"></script>\n<script src="/assets/v5.js"></script>',html,flags=re.S,count=1)
html=html.replace('<title>Blorp V3.1 — Build Fast (Layout Fixed)</title>', '<title>Blorp V5 — Studio Foundation</title>')
html=html.replace('<div class="label">Workspace</div><nav', '<div class="label">Workspace</div><nav')
# Keep original pages and add dedicated account and projects navigation.
html=html.replace('<button class="active" data-view="overview">','<button data-view="account" class="active"><span class="v5-navsymbol">◫</span> Dashboard</button>\n<button data-view="projects"><span class="v5-navsymbol">▣</span> Projects</button>\n<button data-view="overview">',1)
html=html.replace('<div class="label">Manage</div>', '<div class="label">Manage</div>\n<button data-view="addons"><span class="v5-navsymbol">✣</span> Add-ons</button>\n<button data-view="membership"><span class="v5-navsymbol">◈</span> Membership</button>',1)
html=html.replace('<section class="tab active" id="overview">','<section class="tab" id="overview">',1)
# Replace standard playground layout but preserve existing event hook IDs.
start=html.index('<section class="tab" id="playground">')
end=html.index('<section class="tab" id="providers">',start)
new_playground='''<section class="tab" id="playground">
<div class="ai-stage">
 <div class="ai-heading"><div><p class="kicker">BLORP / AI CHAT</p><h1>Ask <em>anything.</em></h1><p class="subtitle">One calm workspace for thinking, writing, and exploring models.</p></div><button type="button" class="btn" id="clearChat">↺ New conversation</button></div>
 <div class="ai-switchrow"><div class="ai-modes" role="group" aria-label="Blorp working mode"><button class="ai-mode on" data-ai-mode="chat">☷ Chat</button><button class="ai-mode" data-ai-mode="build">⌘ Build</button><button class="ai-mode" data-ai-mode="autopilot">✦ Autopilot</button></div><div class="ai-toolbar"><label class="sr-only" for="aiModel">Chat model</label><select id="aiModel" class="ai-model-select"><option>Blorp V1</option><option>Blorp V2</option><option selected>Blorp V3</option><option>Blorp V4</option><option>Blorp V5</option></select><button type="button" class="btn" id="aiToolsBtn">✣ Tools</button></div></div>
 <div class="ai-conversation"><div class="ai-trust"><span class="ai-dot"></span> Interface preview · No model requests are sent</div><div class="message-area" id="messages"><div class="bubble">Hey there! 👋 I'm Blorp's preview assistant. This chat is a local interface demo—not a connected AI model.</div></div></div>
 <div class="ai-composer"><div class="chatbox"><textarea id="prompt" aria-label="Prompt" placeholder="Message Blorp..." rows="2"></textarea><button class="btn primary" id="send">↑</button></div><div class="ai-composefoot"><span>Model selection and tools are planned integrations</span><span>Enter to send · Shift+Enter newline</span></div></div>
</div>
</section>
'''
html=html[:start]+new_playground+html[end:]
# Add the new substantial sections before settings.
anchor='<section class="tab" id="settings">'
new_sections='''
<section class="tab active" id="account">
  <div class="v5-page-heading"><div><p class="kicker">YOUR BLORP WORKSPACE</p><h1>Your space to <em>create.</em></h1><p class="subtitle">Projects, membership, credits, and the tools that power your work.</p></div><button type="button" class="btn primary" data-open="builder">✦ Start a build</button></div>
  <div class="account-hero panel"><div class="account-hello"><div class="account-portrait">b.</div><div><span class="account-eyebrow">WELCOME TO BLORP</span><h2 id="v5Hello">Your creator dashboard</h2><p id="v5AccountLead">Sign in to save your profile on the local development server.</p></div></div><span class="account-plan-pill" id="v5AccountPlan">FREE PLAN</span></div>
  <div class="v5-metrics"><div class="v5-metric"><span>YOUR PLAN</span><strong id="v5PlanMetric">Free</strong><small>Local membership status</small></div><div class="v5-metric"><span>AVAILABLE CREDITS</span><strong id="v5CreditsMetric">—</strong><small>4M on local signup · No live billing</small></div><div class="v5-metric"><span>MY PROJECTS</span><strong id="v5ProjectsMetric">0</strong><small>Drafts stored in this browser</small></div><div class="v5-metric"><span>BUILD FAST</span><strong id="v5BuildAccess">Locked</strong><small>Agent execution requires paid access</small></div></div>
  <div class="v5-two-col"><div class="panel"><div class="panelhead"><div><h2>Continue building</h2><p class="subtle" style="margin:7px 0 0">Keep your creative momentum.</p></div><button class="chooser" data-open="projects">All projects ↗</button></div><div id="v5RecentProjects" class="v5-recent"><div class="v5-empty">No projects yet. Start with your first idea.</div></div></div><div class="panel v5-profile-panel"><div class="panelhead"><h2>Account & access</h2><span class="tag">Local foundation</span></div><p class="v5-profile-line"><span>Email</span><strong id="v5ProfileEmail">Not signed in</strong></p><p class="v5-profile-line"><span>Membership</span><strong id="v5ProfilePlan">Free</strong></p><p class="v5-profile-line"><span>Multi-agent runs</span><strong id="v5ProfileRuns">Not connected</strong></p><button class="btn" type="button" data-open="membership">Explore plans →</button><p class="form-hint">Free credits are stored in the local backend. No actual inference is metered yet.</p></div></div>
</section>
<section class="tab" id="projects"><div class="v5-page-heading"><div><p class="kicker">YOUR WORK</p><h1>Project <em>Library.</em></h1><p class="subtitle">Find your drafts and continue in the Build Playground.</p></div><button class="btn primary" id="v5NewProject">＋ New project</button></div><div class="panel"><div class="panelhead"><h2>My projects</h2><div class="v5-sync-actions"><button class="btn" type="button" id="v5BackupProjects">↑ Back up</button><button class="btn" type="button" id="v5RestoreProjects">↓ Restore</button></div></div><div id="v5ProjectsList" class="v5-project-list"></div></div><div class="mutedbox">Drafts remain in browser storage. Signed-in users can manually back up and restore them on this local development server. Browser drafts are not isolated between accounts using the same browser; do not store sensitive project data yet.</div></section>
<section class="tab" id="addons"><div class="v5-page-heading"><div><p class="kicker">EXTEND YOUR WORKSPACE</p><h1>Blorp <em>Add-ons.</em></h1><p class="subtitle">Explore tools, reusable skills, and future MCP integrations—all in one place.</p></div><span class="preview-badge">◉ CONNECTIONS NOT LIVE</span></div>
 <div class="addons-feature panel"><div><p class="kicker">YOUR TOOLS, YOUR RULES</p><h2>Give your agents superpowers.</h2><p>Find the right tools for research, design, code, and deployment. Set agent permissions before connecting anything.</p></div><span class="addons-orb" aria-hidden="true">✣</span></div>
 <div class="addons-controls"><div class="addons-tabs" role="group" aria-label="Add-on library section"><button class="selected" data-addontab="discover">Discover</button><button data-addontab="mine">My add-ons</button><button data-addontab="skills">Skills</button></div><input class="search" id="addonSearch" placeholder="Search tools and skills..." aria-label="Search add-ons"/></div>
 <div id="addonsDiscover"><div class="addons-filter" id="addonFilters"></div><div class="addon-grid" id="addonGrid"></div></div>
 <div id="addonsMine" hidden><div id="addonInstalled" class="addon-grid"></div><p class="form-hint">These are browser-only configuration preferences. No external account is connected.</p></div>
 <div id="addonsSkills" hidden><div class="addon-grid" id="skillGrid"></div><p class="form-hint">Skill switches are saved as local preferences; they are not injected into actual models yet.</p></div>
 <div class="panel under addons-custom"><div><h2>Custom MCP integrations</h2><p class="subtitle" style="margin-top:6px">Bring your own compatible tool server after our secure connector runtime is available.</p></div><button type="button" class="btn" id="customMcpBtn">＋ Register a draft</button></div>
</section>
<section class="tab" id="membership"><div class="v5-page-heading"><div><p class="kicker">MEMBERSHIP & CREDITS</p><h1>Plans built for <em>makers.</em></h1><p class="subtitle">Start free. Unlock managed multi-agent execution when our billing service launches.</p></div><span class="account-plan-pill" id="memberCurrentPlan">CURRENT · FREE</span></div>
 <div class="billing-toolbar"><div class="billing-switch" role="group" aria-label="Billing frequency"><button type="button" data-billing="monthly" class="selected">Monthly</button><button type="button" data-billing="annual">Annual <span>Save 10%</span></button></div><p>USD · No payments enabled in this version</p></div>
 <div class="pricing-grid">
  <article class="pricing-card"><span class="pricing-index">START HERE</span><h2>Free</h2><p>Explore Blorp and plan your ideas.</p><div class="pricing-price"><strong>$0</strong><small>/ forever</small></div><ul><li>4,000,000 starter credits</li><li>AI interface preview</li><li>Project drafts and design planning</li><li>Multi-agent execution locked</li></ul><button class="btn" type="button" disabled>Current default plan</button></article>
  <article class="pricing-card featured"><span class="pricing-index">FOR BUILDERS</span><h2>Builder</h2><p>More power for everyday shipping.</p><div class="pricing-price"><strong id="builderPrice">$20</strong><small>/mo</small></div><p class="billed-yearly" id="builderBilled">$20 billed monthly</p><ul><li>Multi Task access when launched</li><li>Five-hour rolling compute window</li><li>Token allowance: to be set by testing</li><li>Model routing up to eligible tiers</li></ul><button class="btn primary" type="button" id="builderPlanBtn">Preview Builder benefits</button></article>
  <article class="pricing-card"><span class="pricing-index">FOR STUDIOS</span><h2>Studio</h2><p>High-capacity workflows for teams.</p><div class="pricing-price"><strong id="studioPrice">$50</strong><small>/mo</small></div><p class="billed-yearly" id="studioBilled">$50 billed monthly</p><ul><li>High-capacity build sessions</li><li>Premium model routing priority</li><li>More parallel agent capacity</li><li>Fair-use and security safeguards</li></ul><button class="btn" type="button" id="studioPlanBtn">Preview Studio benefits</button></article>
 </div>
 <div class="mutedbox">These are proposed prices, not active subscriptions. Credits and allowances have no monetary value until our real model billing and server-side metering are connected. No plan can be purchased here.</div>
</section>
'''
html=html.replace(anchor,new_sections+anchor,1)
# Dialog for scoped local add-on preferences.
html=html.replace('<div class="toast" id="toast" role="status"></div>', '''<dialog id="addonDialog" class="blorp-modal v5-dialog"><form id="addonForm" class="modal-form"><div class="dialog-head"><div><p class="kicker">ADD-ON CONFIGURATION</p><h2 id="addonDialogTitle">Set permissions</h2><p class="build-dialog-desc" id="addonDialogDesc">Preview-only configuration. No external service is connected.</p></div><button type="button" class="dialog-close" data-close-dialog="addonDialog">✕</button></div><input type="hidden" id="addonId"/><label class="field-label">Which agents may request this tool?</label><div class="v5-check-row"><label><input type="checkbox" name="addonRole" value="Research"/> Research</label><label><input type="checkbox" name="addonRole" value="Design"/> Design</label><label><input type="checkbox" name="addonRole" value="Builder"/> Builder</label><label><input type="checkbox" name="addonRole" value="QA"/> QA</label></div><label class="v5-approve"><input type="checkbox" id="addonAskBefore" checked/> Require approval for sensitive actions</label><p class="form-hint">This saves a browser preference only. Real integrations will require OAuth or verified MCP credentials and server-side authorization.</p><div class="dialog-actions"><button type="button" class="btn" id="addonDisable">Disable</button><button type="submit" class="btn primary">Save preview settings</button></div></form></dialog>
<dialog id="mcpDialog" class="blorp-modal v5-dialog"><form id="mcpForm" class="modal-form"><div class="dialog-head"><div><p class="kicker">CUSTOM INTEGRATION DRAFT</p><h2>MCP server</h2></div><button type="button" class="dialog-close" data-close-dialog="mcpDialog">✕</button></div><label class="field-label" for="mcpName">Display name</label><input id="mcpName" class="search" required maxlength="55" placeholder="My tools"/><label class="field-label" for="mcpAddress">Server URL (metadata only)</label><input id="mcpAddress" class="search" type="url" required maxlength="300" placeholder="https://example.com/mcp"/><p class="form-hint">URLs are not contacted. Never enter secrets or tokens here.</p><button class="btn primary fill-btn" type="submit">Save draft</button></form></dialog>
<div class="toast" id="toast" role="status"></div>''',1)
# Maintain existing nav dispatch, extend labels map.
js=js.replace("const labels={overview:'Overview'", "const labels={account:'Dashboard',projects:'Projects',addons:'Add-ons',membership:'Membership',overview:'Overview'",1)
# Current original auth uses UI-only fake sign-in. Replace with server-backed local development auth.
needle="document.getElementById('authForm').addEventListener('submit',e=>{e.preventDefault();const email=document.getElementById('authEmail').value.trim();const name=authMode==='signup'?document.getElementById('authName').value.trim():email.split('@')[0];if(!email||!document.getElementById('authPassword').value)return;previewAccount={email,name:name||'Member'};document.getElementById('authPassword').value='';renderPreviewAuth();dialogHide('authDialog');showToast('Preview session only · not authenticated');});"
replace="""document.getElementById('authForm').addEventListener('submit',async e=>{
 e.preventDefault();const email=document.getElementById('authEmail').value.trim();const password=document.getElementById('authPassword').value;
 const name=authMode==='signup'?document.getElementById('authName').value.trim():'';
 if(!email||!password)return;
 if(location.protocol==='file:'){showToast('Start the Blorp local server to use real sign-in');return;}
 const submit=document.getElementById('authSubmit');submit.disabled=true;submit.textContent='Checking account…';
 try{const r=await fetch('/api/auth/'+(authMode==='signup'?'signup':'signin'),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,name})});const body=await r.json();if(!r.ok)throw Error(body.error||'Sign in failed');previewAccount=body.user;renderPreviewAuth();dialogHide('authDialog');document.getElementById('authPassword').value='';window.dispatchEvent(new CustomEvent('blorp:authchange',{detail:body.user}));showToast('Signed in to local Blorp');}catch(err){showToast(err.message)}finally{submit.disabled=false;submit.textContent=authMode==='signup'?'Sign up':'Sign in'}
});"""
assert needle in js
js=js.replace(needle,replace)
needle2="document.getElementById('signOutBtn').addEventListener('click',()=>{previewAccount=null;renderPreviewAuth();showToast('Preview session cleared');});"
rep2="""document.getElementById('signOutBtn').addEventListener('click',async()=>{try{await fetch('/api/auth/signout',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}'});}catch(e){}previewAccount=null;renderPreviewAuth();window.dispatchEvent(new CustomEvent('blorp:authchange',{detail:null}));showToast('Signed out');});"""
assert needle2 in js
js=js.replace(needle2,rep2)
js=js.replace("document.getElementById('authSubmit').textContent=isSignUp?'Preview sign up':'Preview sign in'", "document.getElementById('authSubmit').textContent=isSignUp?'Sign up':'Sign in'")
html=html.replace('⚠️ UI demo only: no real account is created or verified. Do not enter a password you use anywhere else.','Local development sign-in uses the bundled Python + SQLite server. Not yet production hardened.').replace('Continue in preview','Sign in').replace('Real sign-in, account security and paid plans will be connected later through the backend.','Local account data is stored in SQLite on your own PC. Public launch requires a production auth and security review.')
html=html.replace('class="nav" id="mainnav"', 'class="nav" id="mainnav"')
html=html.replace('style="height:33px;width:33px" id="accountAvatar"','style="height:33px;width:33px" id="accountAvatar"')
# Make dashboard initial and update section badge, avoiding fake overview claims.
html=html.replace('<div class="crumb">Workspace <span> / </span> <span id="crumb">Overview</span>','<div class="crumb">Workspace <span> / </span> <span id="crumb">Dashboard</span>')
# Persist extracted assets.
assets=ROOT/'public/assets';assets.mkdir(parents=True,exist_ok=True)
(assets/'base.css').write_text(css,encoding='utf-8')
(assets/'base.js').write_text(js,encoding='utf-8')
(ROOT/'public/index.html').write_text(html,encoding='utf-8')
print('Wrote modular original + V5 scaffold:',len(html),len(css),len(js))

# Restore V5.1 local-agent additions after base regeneration.
import runpy
runpy.run_path(str(ROOT/'patch_frontend.py'))
