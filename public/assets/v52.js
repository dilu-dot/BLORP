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
   loadMyPayments().catch(err=>say(err.message));
   if(isOwner())loadOwner().catch(err=>say(err.message));
 }
 window.addEventListener('blorp:authchange',e=>updateAccount(e.detail));
 // Existing V5 account restore emits blorp:authchange after /api/auth/me succeeds.
 if(!sitePreview)api('/api/auth/me').then(r=>updateAccount(r.user)).catch(()=>{});
 const expiry=node('p','form-hint');expiry.id='membershipExpiry';$('v5ProfilePlan').after(expiry);

 // Model selection, local chat, and project drafts stay independent of payment.
 window.addEventListener('blorp:selectplan',e=>{
   pendingPlan=e.detail;
   if(!account){say('Sign in to request a membership');if(typeof openAuth==='function')openAuth('signin');return;}
   const annual=document.querySelector('[data-billing="annual"].selected')!==null;
   const interval=annual?'annual':'monthly',amt=prices.find(x=>x.plan===pendingPlan&&x.interval===interval);
   $('paymentPanel').hidden=false;
   $('paymentTitle').textContent=`Request ${pendingPlan==='builder'?'Builder':'Studio'} membership`;
   $('paymentSummary').textContent=`${amt?'$'+(amt.amount_cents/100).toFixed(2):'—'} USD · ${interval}. Your membership starts only after payment is independently verified and approved by the owner.`;
   $('paymentStatus').textContent='No charge is made by submitting this form.';
   $('paymentPanel').scrollIntoView({behavior:'smooth',block:'center'});
 });
 async function loadPlans(){if(sitePreview)return;
   const result=await api('/api/billing/plans');prices=result.plans||[];paymentInstructions=result.payment_instructions||'';
   $('paymentInstructions').textContent=paymentInstructions||'No bank or UPI details configured. Request access and contact the owner for payment instructions.';
   checkout=Object.fromEntries(prices.map(p=>[`${p.plan}:${p.interval}`,p.checkout_url]));
 }
 async function loadMyPayments(){if(sitePreview||!account)return;
   const result=await api('/api/billing/requests');const container=$('myPaymentRequests');container.replaceChildren();
   if(!result.requests.length)container.append(node('p','subtitle','No payment requests yet.'));
   for(const r of result.requests)row(container,`${r.plan.toUpperCase()} · ${r.interval}`,`$${(r.amount_cents/100).toFixed(2)} USD · ${r.status.toUpperCase()} · ${prettyDate(r.created_at)} · ${r.method==='hosted_link'?'Hosted payment link':'Manual payment'}`);
 }
 $('refreshPayments').addEventListener('click',()=>loadMyPayments().catch(err=>say(err.message)));
 $('paymentMethod').addEventListener('change',()=>{const method=$('paymentMethod').value;const annual=document.querySelector('[data-billing="annual"].selected')!==null;const url=checkout[`${pendingPlan}:${annual?'annual':'monthly'}`];
   $('paymentInstructions').textContent=method==='hosted_link'?(url?'An external hosted checkout link will open. The owner must still verify payment.':'No hosted payment link has been configured for this plan yet.'):(paymentInstructions||'Contact the owner for bank/UPI details; no payment is collected by Blorp.');
 });
 $('paymentRequestForm').addEventListener('submit',async e=>{
   e.preventDefault();if(!account){say('Sign in first');return;}
   const interval=document.querySelector('[data-billing="annual"].selected')?'annual':'monthly';
   const method=$('paymentMethod').value,button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;
   try{
     const res=await api('/api/billing/request',{plan:pendingPlan,interval,method});
     $('paymentStatus').textContent=`Request ${res.request_id.slice(0,9)} created · PENDING OWNER REVIEW. This is not a payment confirmation.`;
     await loadMyPayments();
     if(res.checkout_url){ // This URL is only supplied by a server admin via env config; validate on the server.
       const a=node('a','btn primary','Open secure hosted checkout ↗');a.href=res.checkout_url;a.target='_blank';a.rel='noopener noreferrer';$('paymentStatus').append(node('span','', ' '),a);
     }
   }catch(err){$('paymentStatus').textContent=err.message;}
   finally{button.disabled=false;}
 });

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
 async function initGoogle(){if(sitePreview){$('googleAuthHint').textContent='Google sign-in requires the running Blorp server and your OAuth client configuration.';return;}
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

 // Private owner actions. Every request is re-authorized by server; DOM visibility does not confer access.
 const money=r=>`$${(r.amount_cents/100).toFixed(2)} USD`;
 async function loadOwner(){if(!isOwner()||sitePreview)return;
   const data=await api('/api/owner/overview');
   const summary=$('ownerSummary');summary.replaceChildren();
   for(const [label,count] of [['Members',data.members.length],['Pending requests',data.payments.filter(x=>x.status==='pending').length],['Active paid accounts',data.members.filter(x=>['builder','studio'].includes(x.effective_plan)).length]]){
     const stat=node('div','panel v52-owner-stat');stat.append(node('small','',label),node('strong','',String(count)));summary.append(stat);
   }
   const payments=$('ownerPaymentRequests');payments.replaceChildren();
   if(!data.payments.length)payments.append(node('p','subtitle','No payment requests yet.'));
   for(const p of data.payments){
     const actions=p.status==='pending'?[{label:'Approve · verified payment',primary:true,onClick:()=>reviewRequest(p,'approve')},{label:'Reject',onClick:()=>reviewRequest(p,'reject')}]:[];
     row(payments,`${p.name} (${p.email})`,`${p.plan.toUpperCase()} · ${p.interval} · ${money(p)} · ${p.status.toUpperCase()} · ${prettyDate(p.created_at)} · ${p.method}`,actions);
   }
   const members=$('ownerMembers');members.replaceChildren();const target=$('ownerTarget');target.replaceChildren();
   for(const member of data.members){
     row(members,member.email,`${member.name} · ${member.effective_plan.toUpperCase()} · ${member.role} · expires ${prettyDate(member.plan_expires_at)}`);
     target.append(new Option(member.email,member.id));
   }
   const audit=$('ownerAudit');audit.replaceChildren();for(const entry of data.audit)row(audit,`${entry.old_plan} → ${entry.new_plan}`,`${entry.reason} · ${prettyDate(entry.created_at)}`);
 }
 async function reviewRequest(p,decision){
   if(decision==='approve'&&!confirm(`Confirm you've independently verified ${money(p)} from ${p.email}? This will activate ${p.plan.toUpperCase()} access.`))return;
   if(decision==='reject'&&!confirm(`Reject payment request from ${p.email}?`))return;
   try{await api('/api/owner/payments/decision',{request_id:p.id,decision,verified_payment:decision==='approve',note:decision==='approve'?'Payment confirmed independently by owner':'Request rejected by owner'});say(`Request ${decision}d`);await loadOwner();}
   catch(err){say(err.message)}
 }
 $('ownerRefresh').addEventListener('click',()=>loadOwner().catch(err=>say(err.message)));
 $('ownerGrantForm').addEventListener('submit',async e=>{
   e.preventDefault();if(!isOwner())return;
   const data={user_id:$('ownerTarget').value,plan:$('ownerPlan').value,days:Number($('ownerDays').value),reason:$('ownerReason').value.trim()};
   const label=$('ownerTarget').selectedOptions[0]?.textContent||'this user';
   if(!confirm(`Change ${label} to ${data.plan.toUpperCase()} for ${data.days} days? This will be audited.`))return;
   try{await api('/api/owner/memberships/set',data);$('ownerReason').value='';say('Member access updated');await loadOwner();}
   catch(err){say(err.message)}
 });
 document.querySelectorAll('[data-view="owner"]').forEach(b=>b.addEventListener('click',()=>loadOwner().catch(err=>say(err.message))));
 loadPlans().catch(err=>say(err.message));
 refreshGates();
})();
