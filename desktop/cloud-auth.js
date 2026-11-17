"use strict";
/** BLORP cloud auth. Public client key only. Keep tokens in Electron main (encrypted at rest). */
const fs=require("node:fs"), path=require("node:path"), http=require("node:http");
const {createClient}=require("@supabase/supabase-js");
const SUPABASE_URL="https://piwcwmspjhtalryzpkez.supabase.co";
const PUBLIC_KEY="sb_publishable_Ly9CktPI7pf7PnPxRSxfTw_EwqUj5mE";
const CALLBACK="http://127.0.0.1:47856/blorp-auth/callback";
function encryptedStorage(dir, safeStorage){
 const file=path.join(dir,"cloud-session.enc");let state={};
 try{if(safeStorage.isEncryptionAvailable()&&fs.existsSync(file)){
   const s=JSON.parse(safeStorage.decryptString(fs.readFileSync(file)));
   if(s&&typeof s==="object"&&!Array.isArray(s))state=s;
 }}catch{console.warn("Cloud credentials could not be restored");}
 function save(){
   if(!safeStorage.isEncryptionAvailable())return; // never save unencrypted tokens
   fs.mkdirSync(dir,{recursive:true});
   const tmp=file+".tmp";
   fs.writeFileSync(tmp,safeStorage.encryptString(JSON.stringify(state)),{mode:0o600});
   fs.renameSync(tmp,file);
 }
 return {getItem:k=>state[k]??null,setItem:(k,v)=>{state[k]=v;save();},removeItem:k=>{delete state[k];save();}};
}
class BlorpCloudAuth {
 constructor({dir,safeStorage,shell}){
   this.shell=shell;
   this.client=createClient(SUPABASE_URL,PUBLIC_KEY,{auth:{
     persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,flowType:"pkce",
     storage:encryptedStorage(dir,safeStorage)
   }});
   this.googleBusy=false;
 }
 async providerEnabled(){
   try{
     const r=await fetch(SUPABASE_URL+"/auth/v1/settings",{headers:{apikey:PUBLIC_KEY},signal:AbortSignal.timeout(8000)});
     const j=await r.json();return Boolean(r.ok&&j?.external?.google===true);
   }catch{return false;}
 }
 async status(){
   const {data:{session},error}=await this.client.auth.getSession();
   if(error)throw Error("Could not restore cloud session.");
   const googleEnabled=await this.providerEnabled();
   if(!session)return {signedIn:false,googleEnabled};
   const {data:{user},error:authError}=await this.client.auth.getUser();
   if(authError||!user)return {signedIn:false,googleEnabled,message:"Session expired. Sign in again."};
   const profile={id:user.id,email:user.email||"",name:user.user_metadata?.full_name||user.email?.split("@")[0]||"Member"};
   try{
     const {data,error:membershipError}=await this.client.functions.invoke("blorp-membership",{body:{action:"me"}});
     if(membershipError||!data||data.error)throw Error("Backend unavailable");
     return {signedIn:true,user:profile,googleEnabled,membershipVerified:true,owner:false,
       plan:data.plan||"free",expires_at:data.expires_at||null,
       prices:data.prices||[],payment_requests:data.payment_requests||[]};
   }catch{
     return {signedIn:true,user:profile,googleEnabled,membershipVerified:false,owner:false,
       plan:"free",expires_at:null,prices:[],payment_requests:[],
       message:"Membership could not be verified. Premium features are locked."};
   }
 }
 async signIn(value){
   const email=String(value?.email||"").trim().toLowerCase(),password=String(value?.password||"");
   if(!/^.+@.+\..+$/.test(email)||password.length<6||password.length>160)throw Error("Enter a valid email and password.");
   const {error}=await this.client.auth.signInWithPassword({email,password});
   if(error)throw Error(error.message);
   return this.status();
 }
 async signUp(value){
   const email=String(value?.email||"").trim().toLowerCase(),password=String(value?.password||"");
   if(!/^.+@.+\..+$/.test(email)||password.length<10||password.length>160)
     throw Error("Enter a valid email and a password with at least 10 characters.");
   const {data,error}=await this.client.auth.signUp({email,password});
   if(error)throw Error(error.message);
   if(!data.session)return {signedIn:false,confirmationNeeded:true,googleEnabled:await this.providerEnabled(),
     message:"Check your email and confirm your account, then return to Blorp to sign in."};
   return this.status();
 }
 async signOut(){
   const {error}=await this.client.auth.signOut();
   if(error)throw Error(error.message);
   return {signedIn:false,googleEnabled:await this.providerEnabled()};
 }
 async google(){
   if(this.googleBusy)throw Error("Google login is already open.");
   if(!await this.providerEnabled())throw Error("Enable Google under BLORP Supabase Authentication providers first.");
   this.googleBusy=true;
   const server=http.createServer();
   let resolveCode,rejectCode,timer,accepted=false;
   const codePromise=new Promise((res,rej)=>{resolveCode=res;rejectCode=rej;});
   server.on("request",(req,res)=>{
     let u;try{u=new URL(req.url,"http://127.0.0.1");}catch{res.writeHead(400);res.end();return;}
     if(req.method!=="GET"||u.pathname!=="/blorp-auth/callback"){res.writeHead(404);res.end();return;}
     if(accepted){res.writeHead(409);res.end();return;}
     accepted=true;
     res.writeHead(200,{"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store",
       "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer",
       "Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'"});
     res.end("<!doctype html><meta charset=utf-8><title>Blorp AI</title><style>body{background:#0a2020;color:white;text-align:center;font:18px system-ui;padding:70px}</style><h2>Return to Blorp AI</h2><p>You can close this tab.</p>");
     const code=u.searchParams.get("code");
     if(!code)rejectCode(Error("Google sign-in was cancelled or misconfigured."));
     else resolveCode(code);
   });
   try{
     await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(47856,"127.0.0.1",resolve);});
     const {data,error}=await this.client.auth.signInWithOAuth({
       provider:"google",options:{redirectTo:CALLBACK,skipBrowserRedirect:true}
     });
     if(error||!data?.url)throw Error(error?.message||"Google sign-in unavailable");
     const url=new URL(data.url);
     if(url.origin!==SUPABASE_URL||url.pathname!=="/auth/v1/authorize")throw Error("Invalid Google authorization URL");
     timer=setTimeout(()=>rejectCode(Error("Google sign-in timed out")),150000);
     await this.shell.openExternal(data.url);
     const code=await codePromise;
     const {error:exchangeError}=await this.client.auth.exchangeCodeForSession(code);
     if(exchangeError)throw Error(exchangeError.message);
     return await this.status();
   }finally{
     if(timer)clearTimeout(timer);
     server.close();
     if(typeof server.closeAllConnections==="function")server.closeAllConnections();
     this.googleBusy=false;
   }
 }
}
module.exports={BlorpCloudAuth,encryptedStorage};
