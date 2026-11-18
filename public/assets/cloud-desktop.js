/* Cloud desktop login screen. Works only with restricted blorpCloud preload bridge. */
(()=>{
"use strict";
if(!window.blorpCloud)return;
const cloud=window.blorpCloud;
const root=document.createElement("div");
root.id="blorp-cloud-root";
root.innerHTML='<div class="cloud-auth-cover" id="cloudAuthCover"><section class="cloud-auth-panel"><div class="cloud-brand"><span class="cloud-brand-mark">b.</span><span>BLORP <em>AI</em></span></div><p class="cloud-eyebrow">YOUR WORKSPACE. YOUR DEVICE.</p><h1>Welcome to the next <span>way of building.</span></h1><p class="cloud-muted">Secure cloud membership. Local projects and conversations.</p><div class="cloud-auth-toggle"><button type="button" class="selected" id="cloudLoginTab">Sign in</button><button type="button" id="cloudSignUpTab">Create account</button></div><form id="cloudAuthForm"><label>Email<input id="cloudEmail" type="email" placeholder="you@example.com" required autocomplete="email"></label><label>Password<input id="cloudPassword" type="password" minlength="6" required autocomplete="current-password"></label><button class="cloud-submit" id="cloudSubmit" type="submit">Sign in</button></form><div class="cloud-divider"><span>or</span></div><button class="cloud-google" id="cloudGoogle" type="button" disabled>Continue with Google</button><p id="cloudAuthMessage" class="cloud-auth-message" role="status" aria-live="polite">Connecting to Supabase…</p><p class="cloud-small">Chats and drafts stay in your app storage on this PC. Cloud login does not sync them.</p></section></div><div id="cloudStatusStrip" class="cloud-status-strip" hidden><span class="cloud-dot"></span><span id="cloudAccount"></span><strong id="cloudPlan" class="cloud-plan"></strong><button type="button" id="cloudRefresh">Refresh membership</button><button type="button" id="cloudLogout">Sign out</button></div><div class="cloud-plan-notice" id="cloudPlanNotice" hidden></div>';
document.body.append(root);
const $=id=>document.getElementById(id);
let mode="signIn",current=null,busy=false;
const say=(text,error=false)=>{const el=$("cloudAuthMessage");el.textContent=text||"";el.classList.toggle("error",error);};
function setMode(signUp=false){
  mode=signUp?"signUp":"signIn";
  $("cloudLoginTab").classList.toggle("selected",!signUp);
  $("cloudSignUpTab").classList.toggle("selected",signUp);
  $("cloudSubmit").textContent=signUp?"Create account":"Sign in";
  $("cloudPassword").minLength=signUp?10:6;
  $("cloudPassword").autocomplete=signUp?"new-password":"current-password";
}
function dispatchAccount(s){
  let user=null;
  if(s.signedIn){
    const active=Boolean(s.membershipVerified&&["builder","studio"].includes(s.plan)&&s.expires_at&&Date.parse(s.expires_at)>Date.now());
    user={id:s.user.id,email:s.user.email,name:s.user.name||s.user.email.split("@")[0]||"Member",
      role:"member",plan:s.membershipVerified?s.plan:"free",
      plan_expires_at:s.expires_at?Math.floor(Date.parse(s.expires_at)/1000):null,
      build_fast_unlocked:active,credits_remaining:0};
  }
  try{previewAccount=user;renderPreviewAuth();}catch{}
  window.dispatchEvent(new CustomEvent("blorp:authchange",{detail:user}));
}
function update(s){
 current=s;
 $("cloudAuthCover").hidden=Boolean(s.signedIn);
 $("cloudStatusStrip").hidden=!s.signedIn;
 $("cloudGoogle").disabled=!s.googleEnabled;
 $("cloudGoogle").title=s.googleEnabled?"Google opens in your default browser":"Enable Google provider in Supabase";
 if(s.signedIn){
   $("cloudAccount").textContent=s.user.email;
   $("cloudPlan").textContent=s.membershipVerified?s.plan.toUpperCase():"UNVERIFIED";
   $("cloudPlanNotice").hidden=false;
   $("cloudPlanNotice").textContent=s.membershipVerified
     ?"Cloud membership connected. Local AI building is available in Local Studio. UPI payment requests can be submitted for manual Owner verification; premium cloud AI remains unavailable."
     :(s.message||"Cloud membership unavailable; premium features locked.");
 }else{
   $("cloudPlanNotice").hidden=true;
   say(s.message|| (s.googleEnabled?"Sign in or use Google.":"Email sign-in is ready. Google must be activated in the Supabase Dashboard."));
 }
 if($("ownerNav"))$("ownerNav").hidden=true;
 dispatchAccount(s);
}
async function run(op,payload){
 if(busy)return;
 busy=true;$("cloudSubmit").disabled=true;$("cloudGoogle").disabled=true;
 say("Connecting securely…");
 try{update(await cloud.invoke(op,payload));}
 catch(e){say(e?.message||"Unable to reach the cloud account service.",true);}
 finally{busy=false;$("cloudSubmit").disabled=false;$("cloudGoogle").disabled=!current?.googleEnabled;}
}
$("cloudLoginTab").addEventListener("click",()=>setMode(false));
$("cloudSignUpTab").addEventListener("click",()=>setMode(true));
$("cloudAuthForm").addEventListener("submit",e=>{
 e.preventDefault();
 const email=$("cloudEmail").value,password=$("cloudPassword").value;
 $("cloudPassword").value="";
 run(mode,{email,password});
});
$("cloudGoogle").addEventListener("click",()=>run("google"));
$("cloudRefresh").addEventListener("click",()=>run("status"));
$("cloudLogout").addEventListener("click",()=>run("signOut"));
function openCloud(signUp){
 setMode(signUp);
 $("cloudAuthCover").hidden=false;
 $("cloudEmail").focus();
}
document.addEventListener("click",e=>{
 const button=e.target.closest("#signInBtn,#signUpBtn,#signOutBtn");
 if(!button)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(button.id==="signOutBtn")run("signOut");
 else openCloud(button.id==="signUpBtn");
},true);
document.addEventListener("submit",e=>{
 if(e.target.id!=="authForm")return;
 e.preventDefault();e.stopImmediatePropagation();openCloud(false);
},true);
document.addEventListener("click",e=>{
 if(e.target.closest("#submitUtrBtn,#ownerNav,[data-owner-open]")){
   e.preventDefault();e.stopImmediatePropagation();
   if(typeof showToast==="function")showToast("Use Membership & UPI for verified manual payment requests. Private Owner tools are separate.");
 }
},true);
const note=document.createElement("p");
note.className="cloud-local-hint";
note.textContent="Cloud account active · Local AI Studio builds real files; UPI payment requests require Owner verification.";
if($("account"))$("account").prepend(note);
cloud.invoke("status").then(update).catch(e=>say("Could not connect to Supabase: "+(e.message||"unknown error"),true));
})();