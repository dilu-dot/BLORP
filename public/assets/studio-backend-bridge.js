/* BLORP Studio bridge — real localhost APIs, never production/cloud authentication.
 * Loaded only by /blorp-studio-subscriptions-preview.html served by server.py.
 * File:// keeps the original offline UX; nothing in this file stores API keys or passwords.
 */
(() => {
  'use strict';
  const local = location.protocol === 'http:' &&
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1');
  if (!local || !window.BlorpApp) return;
  const app = window.BlorpApp;
  const $ = id => document.getElementById(id);
  const state = () => app.getState();
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[c]));
  const notify = text => app.notify(String(text));
  let user = null, authMode = 'signin', submitting = false;
  let installed = [], modelConnected = false, chatBusy = false;
  let attempt = null, clockOffset = 0, checkoutBusy = false, qrURL = null;
  let googleClient = '', googleButtonRendered = false;

  const accountChannel = new BroadcastChannel('blorp-local-session');
  accountChannel.onmessage = () => location.reload();

  async function request(path, payload, method) {
    const response = await fetch(path, {
      method: method || (payload === undefined ? 'GET' : 'POST'),
      headers: {
        ...(payload === undefined ? {} : {'Content-Type':'application/json'}),
        ...(user ? {'X-Blorp-Account':user.id} : {})
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      credentials: 'same-origin', cache: 'no-store'
    });
    let data;
    try { data = await response.json(); }
    catch (_) { throw Error('BLORP backend did not return valid JSON'); }
    if (!response.ok) throw Error(data.error || 'BLORP request failed ('+response.status+')');
    return data;
  }

  function showAuth(message) {
    $('authInlineStatus').textContent = message;
    $('authInlineStatus').hidden = false;
  }
  function clearAuth() {
    $('authInlineStatus').textContent = '';
    $('authInlineStatus').hidden = true;
  }
  function setMode(mode) {
    authMode = mode === 'signup' ? 'signup' : 'signin';
    document.querySelectorAll('[data-auth-mode]').forEach(b => {
      const active = b.dataset.authMode === authMode;
      b.classList.toggle('selected', active);
      b.setAttribute('aria-pressed', String(active));
    });
    $('authNameRow').hidden = authMode !== 'signup';
    $('authName').required = authMode === 'signup';
    $('authPassword').autocomplete = authMode === 'signup' ? 'new-password' : 'current-password';
    $('blorpAuthTitle').textContent = authMode === 'signup' ? 'Create your BLORP account.' : 'Welcome back.';
    $('blorpAuthExplainer').textContent = 'Local BLORP account · HTTP-only session cookie · localhost development.';
    $('authSubmit').textContent = authMode === 'signup' ? 'Create account →' : 'Sign in →';
    $('authPasswordHelp').hidden = authMode === 'signup';
    clearAuth();
  }
  function openAuth(mode = 'signin') {
    $('profileClose')?.click();
    setMode(mode);
    $('blorpAuthForm').reset();
    const dlg = $('blorpAuthDialog');
    if (!dlg.open) dlg.showModal();
    $('authEmail').focus();
  }
  function closeAuth() {
    const dlg = $('blorpAuthDialog');
    if (dlg.open) dlg.close();
  }

  function renderAccount() {
    $('profileIdentityName').textContent = user?.name || 'BLORP Studio';
    $('profileIdentityDetail').textContent = user ? user.email + ' · local account' : 'Guest · sign in required';
    $('profileAuthDetail').textContent = user
      ? 'Authenticated on this localhost BLORP server.'
      : 'Email sign-in works on localhost. Google requires owner OAuth configuration.';
    $('authLaunch').textContent = user ? 'Account ✓' : 'Sign in ↗';
    $('profilePlan').textContent = user ? user.plan.toUpperCase() : 'Not signed in';
    $('profileCredits').textContent = user ? Number(user.credits_remaining || 0).toLocaleString('en-IN') : '—';
    $('profileKeyHealth').textContent = 'Provider keys not verified';
    $('previewSignOut').hidden = !user;
    $('previewSignOut').textContent = 'Sign out';
    document.querySelectorAll('#profileAuthActions [data-open-auth]').forEach(b => b.hidden = !!user);
    document.querySelectorAll('#profilePanel .profile-data-row').forEach(row => {
      if (row.querySelector('span')?.textContent.trim() === 'Account status')
        row.querySelector('strong').textContent = user ? 'Signed in (local)' : 'Guest';
    });
    $('profileProjectCount').textContent = String(state().projects.length);
    $('profileRunsCount').textContent = String(state().runs.length);
  }

  function parseProject(row) {
    const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
    const messages = Array.isArray(payload.chatHistory) ? payload.chatHistory : [];
    return {
      project: {
        id: row.id, name: row.title, type: String(payload.type || 'Website'),
        brief: String(payload.brief || ''), created: Number(payload.created) || row.updated_at * 1000
      },
      messages: messages.filter(m => m && ['user','assistant'].includes(m.role) &&
        typeof m.text === 'string').slice(-10).map(m => ({role:m.role, text:m.text.slice(0,900)}))
    };
  }
  async function loadProjects() {
    if (!user) return;
    const account = user;
    const result = await request('/api/projects');
    if (user !== account) return;
    const entries = (result.projects || []).map(parseProject);
    const s = state();
    s.projectFiles = Object.fromEntries(result.projects.filter(p=>p.files).map(p=>[p.id,p.files]));
    s.projects = entries.map(e => e.project);
    s.projectChats = Object.fromEntries(entries.map(e => [e.project.id, e.messages]));
    const prefKey = 'blorp-selected-project:' + user.id;
    const last = sessionStorage.getItem(prefKey);
    s.activeProjectId = s.projects.some(p=>p.id===last) ? last : null;
    app.commit();
    app.rerender();
    renderAccount();
  }
  function clearWorkspace() {
    const s = state();
    s.projectFiles = {}; s.projects = []; s.projectChats = {}; s.activeProjectId = null;
    app.commit(); app.rerender(); renderAccount();
  }
  function backupOfflineDrafts() {
    const key = 'blorp-local-projects-pre-backend-backup-v1';
    if (localStorage.getItem(key)) return;
    try {
      const raw = localStorage.getItem('blorp-frontend-unlocked-v2');
      const old = raw && JSON.parse(raw);
      if (old && Array.isArray(old.projects) && old.projects.length)
        localStorage.setItem(key, JSON.stringify({
          projects:old.projects, projectChats:old.projectChats || {},
          note:'Old offline drafts; not imported automatically into a signed-in account'
        }));
    } catch (_) {}
  }
  async function setAccount(next) {
    user = next || null;
    clearWorkspace();
    if (user) {
      const account = user;
      await loadProjects().catch(err => {
        if (user === account) notify('Could not load projects: ' + err.message);
      });
      if (user === account) void discoverModels();
    }
  }

  async function submitAuth(e) {
    e.preventDefault();
    if (submitting) return;
    const email = $('authEmail').value.trim();
    const password = $('authPassword').value;
    const name = $('authName').value.trim();
    if (!email || !password || (authMode === 'signup' && name.length < 2)) {
      showAuth('Complete your email, password, and name (for sign-up).'); return;
    }
    submitting = true; $('authSubmit').disabled = true; clearAuth();
    try {
      const body = {email, password};
      if (authMode === 'signup') body.name = name;
      const result = await request('/api/auth/' + (authMode === 'signup' ? 'signup' : 'signin'), body);
      accountChannel.postMessage('signed-in');
      $('authPassword').value = '';
      await setAccount(result.user);
      closeAuth();
      notify('Signed in to the local BLORP backend');
    } catch (err) { showAuth(err.message); }
    finally { submitting = false; $('authSubmit').disabled = false; }
  }

  async function signOut() {
    try {
      document.body.inert = true;
      try { await app.flushEditor(); }
      catch (err) {
        if (!confirm('Editor save failed: '+err.message+'. Sign out and discard unsaved edits?')) {
          document.body.inert = false;
          return;
        }
      }
      await request('/api/auth/signout',{});
      accountChannel.postMessage('signed-out');
      // Discard pending callbacks, previews and form contents before another account signs in.
      location.reload();
    } catch (err) { document.body.inert = false; notify(err.message); }
  }

  async function signInGoogle() {
    try {
      if (!googleClient) {
        const cfg = await request('/api/auth/config');
        googleClient = cfg.google_client_id || '';
      }
      if (!googleClient) {
        showAuth('Google OAuth is not configured. Set BLORP_GOOGLE_CLIENT_ID on the backend, then reload. Email sign-in is available.');
        return;
      }
      let target = $('blorpGoogleOfficial');
      if (!target) {
        target = document.createElement('div');
        target.id = 'blorpGoogleOfficial';
        target.style.cssText = 'display:flex;justify-content:center;margin-top:14px';
        $('authGoogle').after(target);
      }
      if (!window.google?.accounts?.id) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://accounts.google.com/gsi/client'; script.async = true;
          script.onload = resolve; script.onerror = () => reject(Error('Google Identity Services could not be loaded'));
          document.head.append(script);
        });
      }
      if (!googleButtonRendered) {
        window.google.accounts.id.initialize({
          client_id: googleClient,
          callback: async ({credential}) => {
            if (!credential) return;
            try {
              const result = await request('/api/auth/google',{credential});
              accountChannel.postMessage('signed-in');
              await setAccount(result.user);
              closeAuth(); notify('Google account verified by BLORP backend');
            } catch (err) { showAuth(err.message); }
          }
        });
        window.google.accounts.id.renderButton(target,{theme:'outline',size:'large',width:300});
        googleButtonRendered = true;
      }
      showAuth('Continue using the official Google button below. Your identity token is verified by the backend.');
    } catch (err) { showAuth(err.message); }
  }

  async function createProject() {
    if (!user) { openAuth('signin'); return; }
    const name = $('newProjectName').value.trim();
    if (!name || name.length > 90) { notify('Project name must be 1–90 characters'); return; }
    try {
      const record = await request('/api/projects', {
        title:name, payload:{type:'Website',brief:'',created:Date.now(),chatHistory:[]}
      });
      const s = state();
      s.projects.unshift({id:record.id,name,type:'Website',brief:'',created:Date.now()});
      s.projectChats[record.id]=[];
      app.commit(); app.rerender();
      $('projectDialog').close(); notify('Project saved to your BLORP account');
    } catch (err) { notify(err.message); }
  }
  async function deleteProject(id) {
    if (!user) { openAuth(); return; }
    const project = state().projects.find(p=>p.id===id);
    if (!project || !confirm("Delete '"+project.name+"' from your BLORP account? This cannot be undone.")) return;
    try {
      await request('/api/projects/'+encodeURIComponent(id),undefined,'DELETE');
      const s = state();
      s.projects=s.projects.filter(p=>p.id!==id);
      delete s.projectChats[id];
      if(s.activeProjectId===id)s.activeProjectId=null;
      app.commit();app.rerender();notify('Project deleted from server');
    } catch (err) { notify(err.message); }
  }
  function savePayload(project) {
    const chats = Array.isArray(state().projectChats[project.id]) ? state().projectChats[project.id] : [];
    return {
      type:String(project.type || 'Website').slice(0,50),
      brief:String(project.brief || '').slice(0,800),
      created:Number(project.created)||Date.now(),
      chatHistory:chats.filter(m=>m && ['user','assistant'].includes(m.role))
        .slice(-10).map(m=>({role:m.role,text:String(m.text||'').slice(0,800)}))
    };
  }
  async function saveProject(project) {
    if (!user) return;
    return request('/api/projects',{
      id:project.id, title:project.name, payload:savePayload(project)
    });
  }
  async function discoverModels() {
    const list = document.getElementById('blorpInstalledModels') ||
      document.createElement('datalist');
    list.id = 'blorpInstalledModels'; list.replaceChildren();
    if (!list.isConnected) document.body.append(list);
    $('chatModel').setAttribute('list',list.id);
    try {
      const result = await request('/api/local/models');
      modelConnected = !!result.connected;
      installed = Array.isArray(result.models) ? result.models.filter(s=>typeof s==='string') : [];
      for (const m of installed) {
        const opt = document.createElement('option'); opt.value=m; list.append(opt);
      }
      if (installed.length && !installed.includes($('chatModel').value.trim()))
        $('chatModel').value=installed.includes('blorp:latest')?'blorp:latest':installed[0];
      $('chatModel').title = installed.length ? installed.length+' installed Ollama models available' : 'No local models installed';
    } catch (err) {
      modelConnected=false; installed=[];
      $('chatModel').title='Ollama unavailable: '+err.message;
    }
  }
  async function sendChat() {
    if (chatBusy) return;
    if (!user) { openAuth(); return; }
    const project = app.selectedProject();
    if (!project) return notify('Select a project in Workspace first');
    const message = $('chatInput').value.trim();
    if (!message) return;
    if (message.length < 5 || message.length > 3000)
      return notify('A local AI prompt must be 5–3000 characters');
    if ($('chatProvider').value!=='ollama')
      return notify('Only local Ollama is connected. API provider drafts cannot run yet.');
    const model=$('chatModel').value.trim();
    if (!modelConnected || !installed.includes(model))
      return notify('Choose an installed Ollama model (or start Ollama and refresh the page).');
    const s=state(), current=s.projectChats[project.id]||[];
    const history=current.slice(-10).filter(m=>['user','assistant'].includes(m.role)).map(m=>({
      role:m.role,content:String(m.text).slice(0,4000)
    }));
    chatBusy=true;$('sendChat').disabled=true;$('chatInput').disabled=true;
    current.push({role:'user',text:message},{role:'assistant',text:'Working with '+model+'…',pending:true});
    s.projectChats[project.id]=current;
    $('chatInput').value='';app.rerender();
    try {
      const result=await request('/api/local/chat',{model,message,history});
      const idx=current.findIndex(m=>m.pending);
      if (idx>=0) current.splice(idx,1,{role:'assistant',text:String(result.reply||'').slice(0,5000)});
      app.commit();app.rerender();
      await saveProject(project);
      notify('Ollama replied · '+model);
    } catch (err) {
      const idx=current.findIndex(m=>m.pending);
      if(idx>=0)current.splice(idx,1);
      app.rerender();notify('Ollama: '+err.message);
    } finally {
      chatBusy=false;app.rerender();
    }
  }

  const dlg=$('blorpPaymentDialog'),pform=$('paymentUTRForm');
  const plans={builder:{monthly:20,yearly:216},studio:{monthly:50,yearly:540}};
  function billCycle(){return document.querySelector('[data-billing-cycle].active')?.dataset.billingCycle==='yearly'?'yearly':'monthly';}
  function paymentStatus(text,bad=false) {
    $('paymentFormStatus').textContent=text;
    $('paymentFormStatus').classList.toggle('error',bad);
  }
  function secondsLeft() {
    return attempt?.status==='open' ? Math.max(0,Math.ceil((attempt.expires_at*1000-(Date.now()+clockOffset))/1000)) : 0;
  }
  function renderPaymentClock() {
    const left=secondsLeft(),expired=!attempt||left===0;
    $('paymentCountdown').textContent=String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
    $('paymentProgressFill').style.width=(left/300*100).toFixed(2)+'%';
    $('paymentTimer').classList.toggle('expired',expired);
    $('paymentSubmit').disabled=checkoutBusy||expired;
    if(attempt?.status==='open'&&expired)
      paymentStatus('Five-minute UTR deadline expired. Do not pay twice; contact owner if you already paid.',true);
  }
  async function openPayment(plan) {
    if (!user) {openAuth();return;}
    if (!plans[plan]) return;
    const cycle=billCycle();
    attempt=null;
    $('paymentActiveStage').hidden=false;
    $('paymentSubmittedStage').hidden=true;
    $('paymentPlanLabel').textContent=(plan==='builder'?'Builder':'Studio')+' · '+(cycle==='yearly'?'Yearly':'Monthly');
    $('paymentPriceLabel').textContent='$'+plans[plan][cycle]+' USD list price';
    $('blorpPlanQR').hidden=true;
    $('blorpPlanQR').removeAttribute('src');
    $('blorpPlanQRDescription').textContent='Only owner-configured UPI details from your BLORP server will be displayed. Verify the recipient in your UPI app.';
    $('blorpPlanQRTitle').textContent='Owner UPI QR · configuration required';
    $('paymentAcknowledge').parentElement?.lastChild && ($('paymentAcknowledge').parentElement.lastChild.textContent=' I understand a UTR does not activate membership; owner verification is required.');
    $('paymentSubmit').textContent='Submit UTR for owner verification →';
    pform.reset();
    paymentStatus('Starting secure local checkout…');
    if (!dlg.open) dlg.showModal();
    checkoutBusy=true;renderPaymentClock();
    try {
      const result=await request('/api/billing/attempt',{
        plan,interval:cycle==='yearly'?'annual':'monthly'
      });
      attempt=result;
      clockOffset=result.server_time*1000-Date.now();
      $('paymentPriceLabel').textContent='₹'+(result.paid_inr_paise/100).toLocaleString('en-IN')+' INR';
      $('blorpPlanQRTitle').textContent='Owner-configured UPI QR';
      $('blorpPlanQRDescription').textContent='Pay to '+result.upi_id+' only after verifying the recipient and exact amount in your UPI app.';
      if(qrURL)URL.revokeObjectURL(qrURL);
      const img=await fetch('/api/billing/qr',{credentials:'same-origin',cache:'no-store'});
      if(!img.ok)throw Error('Owner QR is unavailable');
      qrURL=URL.createObjectURL(await img.blob());
      $('blorpPlanQR').src=qrURL;$('blorpPlanQR').hidden=false;
      paymentStatus('Complete the payment using your UPI app, then submit its UTR before the countdown ends. No automatic approval.');
    } catch (err) {paymentStatus(err.message,true);attempt=null;}
    finally {checkoutBusy=false;renderPaymentClock();}
  }
  async function showPayments() {
    if (!user) return;
    try {
      const result=await request('/api/billing/requests');
      $('paymentHistoryList').innerHTML=(result.requests||[]).length
        ? result.requests.slice(0,10).map(x=>'<div class="payment-history-row"><div><strong>'+
            esc(x.plan)+' · '+esc(x.interval)+' · INR '+Number(x.paid_inr_paise/100).toLocaleString('en-IN')+
            '</strong><small>'+esc(x.status)+' · UTR ••••'+esc(String(x.reference||'').slice(-4))+
            '</small></div></div>').join('')
        : '<div class="empty">No backend payment requests yet.</div>';
    } catch (err) {notify(err.message);}
  }
  async function submitPayment(e) {
    e.preventDefault();
    if(!user||!attempt||secondsLeft()===0)return paymentStatus('Start a valid five-minute checkout first.',true);
    if(!$('paymentAcknowledge').checked)return paymentStatus('Confirm owner verification is required.',true);
    checkoutBusy=true;renderPaymentClock();
    try{
      const result=await request('/api/billing/request',{
        attempt_id:attempt.attempt_id,plan:attempt.plan,interval:attempt.interval,method:'manual',
        payer_name:$('paymentPayerName').value.trim(),reference:$('paymentUTRInput').value.trim()
      });
      attempt.status='submitted';
      $('paymentUTRInput').value=''; $('paymentPayerName').value='';
      $('paymentActiveStage').hidden=true;$('paymentSubmittedStage').hidden=false;
      $('paymentSubmittedStage').querySelector('h3').textContent='UTR received · owner review pending';
      $('paymentReceiptText').textContent='Request '+result.request_id.slice(0,10)+'… is pending independent bank verification. Your plan stays unchanged until approved.';
      await showPayments();
      await refreshAccount();
      notify('Payment reference submitted · awaiting independent owner approval');
    }catch(err){paymentStatus(err.message,true);}
    finally{checkoutBusy=false;renderPaymentClock();}
  }
  async function refreshAccount() {
    const data=await request('/api/auth/me');
    user=data.user||null;renderAccount();
  }

  // Capture original preview-only handlers before their target bubble listeners run.
  document.addEventListener('submit', e=>{
    if(e.target.id==='blorpAuthForm') {
      e.preventDefault();e.stopPropagation();submitAuth(e);
    } else if(e.target.id==='projectForm'&&e.submitter?.value==='save') {
      e.preventDefault();e.stopPropagation();createProject();
    } else if(e.target.id==='paymentUTRForm') {
      e.preventDefault();e.stopPropagation();submitPayment(e);
    }
  },true);
  document.addEventListener('click',e=>{
    const button=e.target.closest('button');
    if (!button) return;
    if(button.id==='authLaunch'||button.matches('[data-open-auth]')) {
      e.preventDefault();e.stopPropagation();
      if (button.id === 'authLaunch' && user) $('profileTrigger').click();
      else openAuth(button.dataset.openAuth||'signin');
    } else if(button.matches('[data-auth-mode]')) {
      e.preventDefault();e.stopPropagation();setMode(button.dataset.authMode);
    } else if(button.id==='authDismiss') {
      e.stopPropagation();closeAuth();
    } else if(button.id==='authPasswordToggle') {
      e.stopPropagation();const input=$('authPassword');input.type=input.type==='password'?'text':'password';
      button.textContent=input.type==='password'?'Show':'Hide';
    } else if(button.id==='authGoogle') {
      e.stopPropagation();signInGoogle();
    } else if(button.id==='authPasswordHelp') {
      e.stopPropagation();showAuth('Password recovery is not implemented on this local server.');
    } else if(button.id==='previewSignOut') {
      e.stopPropagation();signOut();
    } else if(button.id==='newProject'&&!user) {
      e.stopPropagation();openAuth();
    } else if(button.matches('[data-delete-project]')) {
      e.preventDefault();e.stopPropagation();deleteProject(button.dataset.deleteProject);
    } else if(button.id==='sendChat') {
      e.stopPropagation();sendChat();
    } else if(button.matches('[data-subscribe]')) {
      e.preventDefault();e.stopPropagation();openPayment(button.dataset.subscribe);
    } else if(['paymentClose','paymentCancel','paymentReceiptClose'].includes(button.id)) {
      e.stopPropagation();if(dlg.open)dlg.close();
    }
  },true);
  document.addEventListener('keydown',e=>{
    if(e.target.id==='chatInput'&&e.key==='Enter'&&!e.shiftKey) {
      e.preventDefault();e.stopPropagation();sendChat();
    }
  },true);
  document.addEventListener('change',e=>{
    if(e.target.id==='workspaceProjectPicker'&&user)
      sessionStorage.setItem('blorp-selected-project:'+user.id,e.target.value||'');
  });
  document.addEventListener('blorp:state',()=> {
    if(user && state().activeProjectId)
      sessionStorage.setItem('blorp-selected-project:'+user.id,state().activeProjectId);
    renderAccount();
  });
  $('profileTrigger').addEventListener('click',()=>setTimeout(renderAccount,0));
  $('authGoogle').setAttribute('aria-label','Continue with verified Google account (when configured)');
  $('blorpAuthDialog').addEventListener('click',e=>{if(e.target===$('blorpAuthDialog'))closeAuth();});
  $('paymentTimer').dataset.serverEnforced='true';
  setInterval(renderPaymentClock,1000);
  window.BlorpBackend={
    enabled:true, getUser:()=>user, refreshAccount, discoverModels, loadProjects,
    saveEditorFiles:(id,files)=>request('/api/projects/files',{account:user?.id,id,files}),
    saveProject, sendChat, openAuth, openPayment
  };

  backupOfflineDrafts();
  clearWorkspace();
  $('profileIdentityDetail').textContent='Connecting to local BLORP…';
  request('/api/auth/me')
    .then(result=>setAccount(result.user))
    .then(()=>showPayments())
    .catch(err=>{renderAccount();notify('Backend unavailable: '+err.message);});
})();
