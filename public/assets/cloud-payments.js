/* BLORP cloud manual UPI payment UI. No automatic payment verification. */
(()=>{
"use strict";
if(!window.blorpCloud)return;
const strip=document.getElementById("cloudStatusStrip");if(!strip)return;
const button=document.createElement("button");button.type="button";button.id="cloudPaymentsOpen";button.textContent="Membership & UPI";
strip.insertBefore(button,document.getElementById("cloudLogout"));
const box=document.createElement("div");box.className="blorp-pay-overlay";box.hidden=true;
box.innerHTML='<section class="blorp-pay-panel" role="dialog" aria-modal="true" aria-labelledby="blorpPayTitle"><header><div><span class="blorp-pay-eyebrow">BLORP · SECURE MEMBERSHIP</span><h2 id="blorpPayTitle">Membership & payments</h2><p>Real cloud status · Manually verified UPI</p></div><button type="button" id="blorpPayClose" aria-label="Close payment panel">✕</button></header><div class="blorp-pay-body"><p id="blorpPayMessage" role="status" aria-live="polite">Checking payment options…</p><div class="blorp-plan-grid" id="blorpPlanGrid"></div><div class="blorp-upi-box"><div><small>PAY TO</small><strong id="blorpUpiId">Not configured</strong><p id="blorpUpiAmount">Select a membership option</p><p>Pay from your bank/UPI app. Save your bank transaction reference (UTR).</p></div><img id="blorpPayQr" alt="Owner configured UPI QR" hidden /></div><form id="blorpPayForm"><label>Plan<select id="blorpPayPlan"><option value="builder">Builder</option><option value="studio">Studio</option></select></label><label>Term<select id="blorpPayTerm"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label><label>Payer name<input id="blorpPayerName" maxlength="100" autocomplete="name" placeholder="Name on bank payment" required /></label><label>UTR / reference<input id="blorpPaymentUtr" maxlength="40" pattern="[A-Za-z0-9-]{8,40}" autocomplete="off" placeholder="As shown by your bank" required /></label><p class="blorp-pay-warning">Submitting a UTR does not confirm payment or activate a plan. Your Owner must independently verify bank receipt before approving. Never send an unpaid or fabricated UTR.</p><button type="submit" id="blorpPaySubmit" disabled>Submit payment for review</button></form><h3>My requests</h3><div id="blorpPayRequests"></div></div></section>';
document.body.append(box);
const $=id=>document.getElementById(id);
let status=null,busy=false;
function say(message,error=false){$("blorpPayMessage").textContent=message;$("blorpPayMessage").classList.toggle("error",error)}
async function call(op,payload){
 try{return await window.blorpCloud.invoke(op,payload)}
 catch(e){throw Error(String(e.message||e).replace(/^Error invoking remote method '[^']+': Error:\s*/,""))}
}
function price(){return (status?.prices||[]).find(x=>x.code===$("blorpPayPlan").value+"_"+$("blorpPayTerm").value)?.amount_inr_paise}
function money(p){return Number.isInteger(p)?new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR"}).format(p/100):"Not configured"}
function draw(){
 $("blorpPlanGrid").replaceChildren();
 for(const p of status?.prices||[]){
   const el=document.createElement("div");el.className="blorp-plan-card";
   const title=document.createElement("strong");title.textContent=p.code.replace("_"," · ");
   const amt=document.createElement("span");amt.textContent=money(p.amount_inr_paise);
   el.append(title,amt);$("blorpPlanGrid").append(el);
 }
 const config=status?.payment_config,amount=price();
 const enabled=Number.isInteger(amount)&&amount>=100&&Boolean(config?.upi_id);
 $("blorpUpiId").textContent=config?.upi_id||"Owner has not configured UPI yet";
 $("blorpUpiAmount").textContent="Expected bank transfer: "+money(amount);
 const qr=$("blorpPayQr");let url="";
 try{const u=new URL(config?.qr_image_url||"");if(u.protocol==="https:")url=u.href}catch{}
 qr.hidden=!url;if(url)qr.src=url;else qr.removeAttribute("src");
 $("blorpPaySubmit").disabled=!enabled||busy;
 $("blorpPayRequests").replaceChildren();
 const requests=status?.payment_requests||[];
 if(!requests.length){const p=document.createElement("p");p.textContent="No payment requests yet.";$("blorpPayRequests").append(p);}
 for(const r of requests){
  const el=document.createElement("p");el.className="blorp-pay-request";
  const date=new Date(r.created_at).toLocaleDateString("en-IN");
  el.textContent=(r.plan||"")+" / "+(r.term||"")+" · "+money(r.amount_inr_paise)+" · "+(r.status||"")+" · "+date;
  $("blorpPayRequests").append(el);
 }
 if(!enabled)say("Payment is unavailable until the Owner configures the UPI ID and this plan's price.",true);
 else say("Payment instructions are configured. Please verify the recipient in your UPI app before transferring money.");
}
async function refresh(){
 status=await call("status");
 if(!status?.signedIn)throw Error("Sign in to submit payment.");
 if(!status.membershipVerified)throw Error("Membership service unavailable.");
 draw();
}
document.addEventListener("click",e=>{
 const link=e.target.closest('[data-view="membership"],[data-open="membership"]');
 if(!link)return;
 e.preventDefault();e.stopImmediatePropagation();
 button.click();
},true);
button.addEventListener("click",async()=>{
 box.hidden=false;say("Loading your cloud payment options…");
 try{await refresh()}catch(e){say(e.message,true);$("blorpPaySubmit").disabled=true}
});
$("blorpPayClose").addEventListener("click",()=>box.hidden=true);
box.addEventListener("click",e=>{if(e.target===box)box.hidden=true});
document.addEventListener("keydown",e=>{if(e.key==="Escape")box.hidden=true});
for(const id of ["blorpPayPlan","blorpPayTerm"])$(id).addEventListener("change",()=>status&&draw());
$("blorpPayForm").addEventListener("submit",async e=>{
 e.preventDefault();if(busy)return;
 if(!status||!Number.isInteger(price())||!status.payment_config?.upi_id)return say("Payments are not configured.",true);
 if(!confirm("Have you ALREADY paid the exact amount shown to the correct account, and verified this UTR in your bank?"))return;
 busy=true;$("blorpPaySubmit").disabled=true;say("Submitting your UTR for independent verification…");
 try{
   const result=await call("submitPayment",{plan:$("blorpPayPlan").value,term:$("blorpPayTerm").value,
     utr:$("blorpPaymentUtr").value,payer_name:$("blorpPayerName").value});
   if(!result?.submitted)throw Error("Payment request not acknowledged");
   $("blorpPaymentUtr").value="";
   await refresh();
   say("Request submitted and pending Owner bank verification. Access is NOT active yet.");
 }catch(err){say(err.message,true)}
 finally{busy=false;if(status)$("blorpPaySubmit").disabled=!(Number.isInteger(price())&&status.payment_config?.upi_id)}
});
window.addEventListener("blorp:authchange",e=>{if(!e.detail){box.hidden=true;status=null}});
})();
