/* Blorp V5.3 — owner-only console + UPI/UTR checkout. No automatic payment verification. */
(() => {
 'use strict';
 const $ = id => document.getElementById(id);
 const localPreview = location.protocol === 'file:';
 const build = (tag, className='', text) => {const e=document.createElement(tag); if(className)e.className=className; if(text!==undefined)e.textContent=String(text); return e;};
 const api = async (url, payload) => {
   const res=await fetch(url,{method:payload===undefined?'GET':'POST',headers:payload===undefined?{}:{'Content-Type':'application/json'},credentials:'same-origin',cache:'no-store',body:payload===undefined?undefined:JSON.stringify(payload)});
   const data=await res.json(); if(!res.ok)throw Error(data.error||`HTTP ${res.status}`); return data;
 };
 const toast = message => typeof showToast==='function'?showToast(message):console.info(message);
 const rupees = paise => typeof paise==='number'?new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(paise/100):'Not set';
 const niceDate = unix => unix?new Date(unix*1000).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'—';
 const isOwner = () => currentAccount?.role==='owner';
 let currentAccount=null, paymentConfig={}, catalog=[], currentPlan='builder', interval='monthly', ownerData=null, qrUrl=null, ownerTab='dashboard';
 let ownerPhotoFile=null;
 const catalogEntry=()=>catalog.find(p=>p.plan===currentPlan&&p.interval===interval);
 const paymentKey=()=>`${currentPlan}:${interval}`;
 function setImage(elementId,visible){const img=$(elementId);if(visible&&qrUrl){img.src=qrUrl;img.hidden=false;}else{img.hidden=true;img.removeAttribute('src');}}
 async function refreshQr(){if(!currentAccount||!paymentConfig.qr_configured)return;
   try{const res=await fetch('/api/billing/qr',{credentials:'same-origin',cache:'no-store'});if(!res.ok)throw Error('QR not available');
     if(qrUrl)URL.revokeObjectURL(qrUrl);qrUrl=URL.createObjectURL(await res.blob());setImage('memberQrImage',true);setImage('ownerQrImage',isOwner());}
   catch(err){console.warn('Could not load payment QR',err)}
 }
 function displayPrice(){const entry=catalogEntry();const amount=paymentConfig.prices_inr_paise?.[paymentKey()];
   $('paymentTitle').textContent=`${currentPlan==='builder'?'Builder':'Studio'} · ${interval==='annual'?'Annual':'Monthly'} membership`;
   $('paymentSummary').textContent=`${entry?'$'+(entry.amount_cents/100).toFixed(0):'—'} USD list price · ${interval==='annual'?'12 months':'1 month'} · Your access activates after owner verification.`;
   $('memberInrAmount').textContent=rupees(amount);
   $('memberUpiId').textContent=paymentConfig.upi_id||'Not configured';
   $('memberQrEmpty').hidden=!!(paymentConfig.qr_configured&&qrUrl);
   setImage('memberQrImage',!!paymentConfig.qr_configured);
   $('submitUtrBtn').disabled=!(paymentConfig.qr_configured&&paymentConfig.upi_id&&Number.isInteger(amount)&&amount>=100);
   $('paymentInstructions').textContent=$('submitUtrBtn').disabled?'Owner must configure a UPI QR and exact INR pricing before accepting payment requests.':'After paying, copy the UTR from your UPI app. Do not pay twice if the request is pending.';
 }
 async function loadPlans(){if(localPreview)return;
   const data=await api('/api/billing/plans');catalog=data.plans||[];paymentConfig=data.upi||{};
   await refreshQr();displayPrice();
 }
 window.blorpLoadPaymentSettings=loadPlans;
 window.addEventListener('blorp:selectplan',e=>{
   if(!currentAccount){toast('Sign in to purchase a membership');return;}
   currentPlan=e.detail;$('paymentPanel').hidden=false;displayPrice();$('paymentPanel').scrollIntoView({behavior:'smooth',block:'start'});
 });
 document.querySelectorAll('[data-billing]').forEach(button=>button.addEventListener('click',()=>{interval=button.dataset.billing;displayPrice();}));
 async function renderMyRequests(){if(!currentAccount||localPreview)return;
   const target=$('myPaymentRequests');target.replaceChildren();
   const data=await api('/api/billing/requests');if(!data.requests.length){target.append(build('p','subtitle','No UTR submissions yet.'));return;}
   data.requests.forEach(item=>{
     const card=build('div','v52-record'),left=build('div','v52-record-info');left.append(build('strong','',`${item.plan.toUpperCase()} · ${item.interval}`),build('small','',`${rupees(item.paid_inr_paise)} · UTR ${item.reference||'Not supplied'} · ${item.status.toUpperCase()} · ${niceDate(item.created_at)}`));
     card.append(left,build('span','v53-badge '+item.status,item.status));target.append(card);
   });
 }
 window.blorpRefreshPayments=()=>renderMyRequests().catch(e=>toast(e.message));
 $('refreshPayments').addEventListener('click',()=>window.blorpRefreshPayments());
 $('paymentRequestForm').addEventListener('submit',async event=>{
   event.preventDefault();if(!currentAccount){toast('Sign in first');return;}
   if($('submitUtrBtn').disabled)return;
   const payload={plan:currentPlan,interval,method:'manual',payer_name:$('paymentPayerName').value.trim(),reference:$('paymentUtr').value.trim()};
   if(!confirm(`Did you pay ${$('memberInrAmount').textContent} to ${paymentConfig.upi_id}? Blorp will only record your UTR for owner review.`))return;
   const button=$('submitUtrBtn');button.disabled=true;
   try{const res=await api('/api/billing/request',payload);$('paymentStatus').textContent=`UTR submitted (${res.reference}). Status: PENDING OWNER REVIEW. Build Fast remains locked until the owner verifies it.`;$('paymentUtr').value='';await renderMyRequests();}
   catch(err){$('paymentStatus').textContent=err.message;}
   finally{displayPrice();}
 });
 function selectOwnerTab(id){ownerTab=id;document.querySelectorAll('[data-owner-tab]').forEach(button=>button.classList.toggle('selected',button.dataset.ownerTab===id));document.querySelectorAll('[data-owner-screen]').forEach(el=>el.hidden=el.dataset.ownerScreen!==id);}
 document.querySelectorAll('[data-owner-tab],[data-owner-open]').forEach(b=>b.addEventListener('click',()=>selectOwnerTab(b.dataset.ownerTab||b.dataset.ownerOpen)));
 function empty(target,label){target.replaceChildren(build('div','v53-preview-empty',label));}
 function paymentRow(p){const el=build('div','v53-payment-row');const main=build('div','v53-row-main');
   main.append(build('strong','',`${p.name||'Customer'} · ${p.email}`),build('small','',`${p.plan.toUpperCase()} · ${p.interval} · ${rupees(p.paid_inr_paise)} · UTR: ${p.reference||'Not supplied'}`),build('small','',`${niceDate(p.created_at)} · ${p.payer_name||'Payer not supplied'}`));
   el.append(main,build('span','v53-badge '+p.status,p.status));
   if(p.status==='pending'){
     const actions=build('div','v53-row-action'),approve=build('button','btn primary','✓ Approve'),reject=build('button','btn reject','Reject');
     approve.type=reject.type='button';approve.addEventListener('click',()=>openReview(p));reject.addEventListener('click',async()=>{
       const reason=prompt(`Reason for rejecting ${p.email}?`,'Payment could not be verified');if(reason===null)return;
       if(!confirm(`Reject ${p.email}'s ${p.plan} membership request?`))return;
       try{await api('/api/owner/payments/decision',{request_id:p.id,decision:'reject',note:reason});toast('Request rejected');await loadOwner();}catch(e){toast(e.message)}
     });actions.append(approve,reject);el.append(actions);
   }return el;
 }
 function populateStats(data){const paid=data.members.filter(m=>['builder','studio'].includes(m.effective_plan));const pending=data.payments.filter(p=>p.status==='pending');
   const values=[['◉','Total users',data.members.length,'Registered accounts'],['♛','Active members',paid.length,'Active Builder / Studio'],['◷','Pending payments',pending.length,'Requires your review'],['◈','Verified revenue',rupees(data.verified_revenue_inr_paise),'Approved UPI requests only']];
   const wrap=$('ownerSummary');wrap.replaceChildren();for(const [glyph,title,value,caption] of values){const box=build('div','v53-kpi');box.append(build('span','',`${glyph}  ${title}`),build('strong','',value),build('small','',caption));wrap.append(box)}
   $('ownerPendingChip').textContent=String(pending.length);$('ownerRevenueTotal').textContent=rupees(data.verified_revenue_inr_paise);
   const bars=$('ownerRevenueChart');bars.replaceChildren();const max=Math.max(1,...(data.revenue_7d||[]).map(d=>d.amount_inr_paise));
   for(const d of data.revenue_7d||[]){const wrap=build('div','v53-chart-bar');wrap.title=`${d.day}: ${rupees(d.amount_inr_paise)}`;const bar=build('div','v53-bar');bar.style.setProperty('--height',`${Math.max(2,Math.round(d.amount_inr_paise/max*88))}%`);wrap.append(bar,build('label','',d.day));bars.append(wrap)}
   const builder=paid.filter(p=>p.effective_plan==='builder').length,studio=paid.length-builder,percent=paid.length?(builder/paid.length*100):0;
   $('ownerDonut').style.setProperty('--builder',percent+'%');$('ownerDonut').style.setProperty('--studio','100%');
   $('ownerDonutCount').replaceChildren(document.createTextNode(String(paid.length)),build('small','','active'));
   const legend=$('ownerDistribution');legend.replaceChildren();for(const [name,count] of [['Builder',builder],['Studio',studio]]){const line=build('p');line.append(build('i'),document.createTextNode(`${name}: ${count}`));legend.append(line)}
 }
 function populateRecords(data){const pending=data.payments.filter(p=>p.status==='pending');
   const preview=$('ownerPendingPreview');preview.replaceChildren();if(!pending.length)empty(preview,'No pending UTR submissions right now.');else pending.slice(0,4).forEach(p=>preview.append(paymentRow(p)));
   const all=$('ownerPaymentRequests');all.replaceChildren();const filter=$('ownerPaymentFilter').value;const subset=data.payments.filter(p=>filter==='all'||p.status===filter);
   if(!subset.length)empty(all,'No payment requests match this filter.');else subset.forEach(p=>all.append(paymentRow(p)));
   const members=$('ownerMembers');members.replaceChildren();if(!data.members.length)empty(members,'No users yet.');else data.members.forEach(u=>{
     const entry=build('div','v53-user-row'),main=build('div','v53-row-main');main.append(build('strong','',u.name||u.email),build('small','',`${u.email} · ${u.role} · Expires: ${niceDate(u.plan_expires_at)}`));entry.append(main,build('span','v53-badge',u.effective_plan));members.append(entry);
   });
   const target=$('ownerTarget');const previous=target.value;target.replaceChildren();data.members.filter(u=>u.role!=='owner').forEach(u=>target.append(new Option(`${u.name} (${u.email})`,u.id)));if([...target.options].some(o=>o.value===previous))target.value=previous;
   const audit=$('ownerAudit');audit.replaceChildren();if(!data.audit.length)empty(audit,'No membership changes recorded.');else data.audit.forEach(a=>{
     const entry=build('div','v53-audit-row'),info=build('div','v53-row-main');info.append(build('strong','',`${a.old_plan} → ${a.new_plan}`),build('small','',`${a.reason} · ${niceDate(a.created_at)}`));entry.append(info);audit.append(entry);
   });
   const recent=$('ownerActivityPreview');recent.replaceChildren();if(!data.audit.length)recent.append(build('div','v53-recent-entry','No owner actions yet.'));
   data.audit.slice(0,4).forEach(a=>recent.append(build('div','v53-recent-entry',`${a.old_plan} → ${a.new_plan} · ${a.reason} · ${niceDate(a.created_at)}`)));
 }
 function populateSettings(data){const set=data.settings||{};
   $('ownerUpiLabel').textContent=set.upi_id||'UPI not configured';$('ownerUpiInput').value=set.upi_id||'';
   $('ownerQrEmpty').hidden=!!(set.qr_configured&&qrUrl);setImage('ownerQrImage',set.qr_configured);
   const mapping={'builder:monthly':'inrBuilderMonthly','builder:annual':'inrBuilderAnnual','studio:monthly':'inrStudioMonthly','studio:annual':'inrStudioAnnual'};
   Object.entries(mapping).forEach(([key,id])=>{$(id).value=Number.isInteger(set.prices_inr_paise?.[key])?(set.prices_inr_paise[key]/100).toFixed(2):''});
 }
 async function loadOwner(){if(!isOwner()||localPreview)return;const data=await api('/api/owner/overview');ownerData=data;
   await refreshQr();populateStats(data);populateRecords(data);populateSettings(data);
 }
 window.blorpLoadOwner=()=>loadOwner().catch(err=>toast(err.message));
 $('ownerRefresh').addEventListener('click',()=>window.blorpLoadOwner());
 $('ownerPaymentFilter').addEventListener('change',()=>ownerData&&populateRecords(ownerData));
 const dialog=build('dialog','v53-verify-modal');dialog.id='v53VerifyDialog';dialog.innerHTML=`<form method="dialog" class="v53-verify-form" id="v53VerifyForm"><h2>Verify payment before approval</h2><p class="form-hint" id="v53VerifySummary"></p><label for="v53VerifyUtr">Type the exact UTR shown in your bank / UPI app</label><input class="search" id="v53VerifyUtr" autocomplete="off" required/><label for="v53VerifyAmount">Confirmed INR amount</label><input class="search" type="number" step="0.01" min="0.01" id="v53VerifyAmount" required/><label for="v53VerifyNote">Verification note</label><input class="search" id="v53VerifyNote" minlength="8" maxlength="240" placeholder="Verified in bank statement" required/><label class="v53-verify-check"><input type="checkbox" id="v53VerifyCheck" required/> I checked the UTR, recipient and exact amount against an independent bank / UPI record.</label><div class="v53-verify-actions"><button class="btn" value="cancel" type="button" id="v53CancelVerify">Cancel</button><button class="btn primary" type="submit">Approve & activate plan</button></div><p class="form-hint" id="v53VerifyError" role="status"></p></form>`;
 document.body.append(dialog);
 let reviewing=null;
 function openReview(p){reviewing=p;$('v53VerifySummary').textContent=`${p.email} · ${p.plan.toUpperCase()} ${p.interval} · UTR ${p.reference} · Expected ${rupees(p.paid_inr_paise)}. Verify outside Blorp first.`;
   $('v53VerifyForm').reset();$('v53VerifyError').textContent='';dialog.showModal();}
 $('v53CancelVerify').addEventListener('click',()=>dialog.close());
 $('v53VerifyForm').addEventListener('submit',async event=>{
   event.preventDefault();if(!reviewing)return;const utr=$('v53VerifyUtr').value.trim().toUpperCase();const amountPaise=Math.round(Number($('v53VerifyAmount').value)*100);
   if(utr!==reviewing.reference||amountPaise!==reviewing.paid_inr_paise){$('v53VerifyError').textContent='UTR and INR amount must match the submitted transaction exactly.';return;}
   const submit=event.currentTarget.querySelector('[type="submit"]');submit.disabled=true;
   try{await api('/api/owner/payments/decision',{request_id:reviewing.id,decision:'approve',verified_payment:true,verified_reference:utr,verified_amount_paise:amountPaise,note:$('v53VerifyNote').value.trim()});dialog.close();toast('Verified payment approved · membership activated');await loadOwner();}
   catch(err){$('v53VerifyError').textContent=err.message;}
   finally{submit.disabled=false;}
 });
 $('ownerGrantForm').addEventListener('submit',async event=>{
   event.preventDefault();if(!isOwner())return;
   const payload={user_id:$('ownerTarget').value,plan:$('ownerPlan').value,days:Number($('ownerDays').value),reason:$('ownerReason').value.trim()};
   if(!payload.user_id){toast('Choose a customer');return;}
   if(!confirm(`Change this account to ${payload.plan.toUpperCase()} for ${payload.days} days? This change is audited.`))return;
   try{await api('/api/owner/memberships/set',payload);$('ownerReason').value='';toast('Membership updated');await loadOwner();}catch(err){toast(err.message)}
 });
 const readerFor=file=>new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('QR image could not be read'));reader.readAsDataURL(file)});
 $('ownerPaymentSettingsForm').addEventListener('submit',async event=>{
   event.preventDefault();if(!isOwner())return;const mapping={'builder:monthly':'inrBuilderMonthly','builder:annual':'inrBuilderAnnual','studio:monthly':'inrStudioMonthly','studio:annual':'inrStudioAnnual'},amounts={};
   for(const [key,id] of Object.entries(mapping)){
     const value=Number($(id).value),paise=Math.round(value*100);if(!Number.isFinite(value)||value<1||Math.abs(value*100-paise)>.00001){$('ownerSettingsStatus').textContent='Enter valid INR amounts with at most two decimal places.';return;}amounts[key]=paise;
   }
   const payload={upi_id:$('ownerUpiInput').value.trim(),prices_inr_paise:amounts};const file=$('ownerQrFile').files[0];
   if(file){if(!['image/png','image/jpeg'].includes(file.type)||file.size>350000){$('ownerSettingsStatus').textContent='Choose a PNG/JPEG image under 350 KB.';return;}payload.qr_data_url=await readerFor(file);}
   const button=event.currentTarget.querySelector('[type="submit"]');button.disabled=true;
   try{await api('/api/owner/payments/settings',payload);$('ownerQrFile').value='';$('ownerSettingsStatus').textContent='Payment QR & INR prices saved.';await loadPlans();await loadOwner();}
   catch(err){$('ownerSettingsStatus').textContent=err.message;}
   finally{button.disabled=false;}
 });
 window.addEventListener('blorp:authchange',event=>{currentAccount=event.detail;
   if(!currentAccount){if(qrUrl){URL.revokeObjectURL(qrUrl);qrUrl=null;}return;}
   loadPlans().catch(err=>toast(err.message));renderMyRequests().catch(err=>toast(err.message));
   if(isOwner())loadOwner().catch(err=>toast(err.message));
 });
 if(!localPreview)api('/api/auth/me').then(({user})=>{currentAccount=user;if(user){loadPlans().catch(()=>{});renderMyRequests().catch(()=>{});if(isOwner())loadOwner().catch(()=>{});}}).catch(()=>{});
})();
