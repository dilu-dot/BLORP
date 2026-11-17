/* Blorp V5.2: local Google sign-in, owner-reviewed membership requests, Build Fast access gate.
   Payments are NOT captured here; a trusted owner must independently verify them. */
(() => {
 'use strict';
 const $=id=>document.getElementById(id);
 const sitePreview=location.protocol==='file:';
 const guarded=new Set(['builder','multitask','workflows','localai']);
 let account=null, googleReady=false, linking=false, pendingPlan='builder', prices=[], checkout={}, paymentInstructions='';
 const say=(message)=>{if(typeof showToast==='function')showToast(message);else console.info(message);};
 const api=async(path,body)=>{
   const response=await fetch(path,{method:body===undefined?'GET':'POST',credentials:'same-origin',headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||`Request failed (${response.status})`);
   return data;
 };
 const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
 const row=(parent,heading,detail,actions=[])=>{
   const div=node('div','v52-record'),info=node('div','v52-record-info');
   info.append(node('strong','',heading),node('small','',detail));div.append(info);
   if(actions.length){const actionArea=node('div','v52-record-actions');for(const item of actions){const b=node('button','btn'+(item.primary?' primary':''),item.label);b.type='button';b.addEventListener('click',item.onClick);actionArea.append(b);}div.append(actionArea);}
   parent.append(div);return div;
 };
 const prettyDate=ts=>ts?new Date(ts*1000).toLocaleDateString(): '—';
 const hasBuild=()=>Boolean(account?.build_fast_unlocked);
 const isOwner=()=>account?.role==='owner';
 const refreshGates=()=>{
   const ownerNav=$('ownerNav');ownerNav.hidden=!isOwner();
   document.querySelectorAll('[data-view]').forEach(button=>{if(guarded.has(button.dataset.view)){button.classList.toggle('v52-locked-nav',!hasBuild());button.title=hasBuild()?'Build Fast': 'Requires Builder or Studio membership';}});
   $('localAiNav').classList.toggle('v52-locked-nav',!hasBuild());
   if(!account && document.querySelector('.tab.active')?.id==='owner')changeView('account');
   $('linkGoogleBtn').hidden=!account||!googleReady;
 };
 window.blorpAuthorizeView=(id)=>{
   if(id==='owner'&&!isOwner()){say('Only the verified Blorp owner can open this page');return false;}
   if(guarded.has(id)&&!hasBuild()){
     if(!account){say('Sign in to unlock Build Fast with a membership');if(typeof openAuth==='function')openAuth('signin');}
     else{say('Build Fast is locked. Choose Builder or Studio to request access.');changeView('membership');}
     return false;
   }
   return true;
 };
 function updateAccount(user){account=user||null;refreshGates();
   $('v5BuildAccess').textContent=hasBuild()?'Unlocked':'Locked';
   $('v5ProfileRuns').textContent=hasBuild()?'Membership enabled · runtime availability varies':'Upgrade required';
   const status=$('membershipExpiry');if(status)status.textContent=account?.plan_expires_at?'Access ends '+prettyDate(account.plan_expires_at):'No active paid membership';
   if(!account){$('myPaymentRequests').replaceChildren(node('p','subtitle','Sign in to view payment requests.'));return;}
   window.blorpRefreshPayments?.();
   if(isOwner())window.blorpLoadOwner?.();
 }
 window.addEventListener('blorp:authchange',e=>updateAccount(e.detail));
 // Existing V5 account restore emits blorp:authchange after /api/auth/me succeeds.
 if(!sitePreview)api('/api/auth/me').then(r=>updateAccount(r.user)).catch(()=>{});
 const expiry=node('p','form-hint');expiry.id='membershipExpiry';$('v5ProfilePlan').after(expiry);

 // V5.3: QR/UTR membership flow is implemented in v53.js.
 // General model selection and local chat remain independent of paid Build Fast.
 // Google Identity Services: official Google SDK button, token checked server-side by google-auth.
 async function googleCallback(response){
   try{
     const endpoint=linking?'/api/auth/google/link':'/api/auth/google';
     const result=await api(endpoint,{credential:response.credential});
     if(!linking){previewAccount=result.user;renderPreviewAuth();dialogHide('authDialog');window.dispatchEvent(new CustomEvent('blorp:authchange',{detail:result.user}));say('Signed in securely with Google');}
     else say('Google account linked successfully');
   }catch(err){say(err.message)}
   finally{linking=false;}
 }
 async function initGoogle(){
  if(window.blorpDesktopGoogle){
     const hint=$('googleAuthHint');
     const button=node('button','btn v52-google-desktop','Continue with Google');
     button.type='button';
     button.style.cssText='display:inline-flex;align-items:center;justify-content:center;padding:11px 20px;border:1px solid #8d9d97;border-radius:24px;min-width:260px;font-weight:600;cursor:pointer;';
     $('googleLoginSlot').replaceChildren(button);
     let configured=false;
     try {
       const cfg=await api('/api/auth/config');
       configured=Boolean(cfg.google_desktop_client_id);
     }catch(err){hint.textContent='The Blorp backend is offline. Google signup will work after connecting the backend.';}
     if(!configured){
       button.disabled=true;
       if(!hint.textContent.includes('offline'))
         hint.textContent='Google desktop sign-in is not configured yet. Add a Google Desktop OAuth client ID to the backend.';
       return;
     }
     googleReady=true;
     refreshGates();
     hint.textContent='Secure Google login opens in your default browser, then returns here.';
     async function launchGoogle(){
       if(button.disabled)return;
       button.disabled=true;
       hint.textContent='Complete Google sign-in in your default browser.';
       try {
         const credential=await window.blorpDesktopGoogle.begin();
         await googleCallback({credential});
         hint.textContent='Google sign-in completed.';
       }catch(err){
         hint.textContent=err.message||'Google sign-in failed.';
         say(hint.textContent);
         linking=false;
       }finally{button.disabled=false;}
     }
     button.addEventListener('click',launchGoogle);
     $('linkGoogleBtn').addEventListener('click',()=>{
       if(!account)return;
       linking=true;
       launchGoogle();
     });
     return;
   }
   if(sitePreview){$('googleAuthHint').textContent='Google sign-in requires the running Blorp server and your OAuth client configuration.';return;}
   const cfg=await api('/api/auth/config');if(!cfg.google_client_id){$('googleAuthHint').textContent='Google login is ready to configure. Add BLORP_GOOGLE_CLIENT_ID to the server environment.';return;}
   const script=document.createElement('script');script.src='https://accounts.google.com/gsi/client';script.async=true;script.defer=true;
   script.onload=()=>{
     if(!window.google?.accounts?.id){$('googleAuthHint').textContent='Google login library unavailable';return;}
     google.accounts.id.initialize({client_id:cfg.google_client_id,callback:googleCallback,auto_select:false,ux_mode:'popup'});
     google.accounts.id.renderButton($('googleLoginSlot'),{type:'standard',theme:'filled_black',size:'large',text:'continue_with',shape:'pill',width:260});
     const slot=node('div','v52-google-link-slot');$('linkGoogleBtn').after(slot);
     google.accounts.id.renderButton(slot,{type:'standard',theme:'filled_black',size:'medium',text:'continue_with',width:230});
     slot.hidden=true;googleReady=true;refreshGates();
     $('linkGoogleBtn').addEventListener('click',()=>{linking=true;slot.hidden=false; $('linkGoogleBtn').hidden=true;say('Choose your Google account to link it securely.');},{once:false});
     $('googleAuthHint').textContent='Verified Google sign-in · existing password accounts must link explicitly.';
   };
   script.onerror=()=>{$('googleAuthHint').textContent='Google sign-in could not load. Check your connection and OAuth origin.';};
   document.head.append(script);
 }
 initGoogle().catch(err=>{$('googleAuthHint').textContent=err.message});

 // V5.3 Owner Console logic is kept in v53.js. The backend enforces every role check.
 refreshGates();
})();
