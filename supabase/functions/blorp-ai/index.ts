// Blorp Cloud AI: JWT-authenticated, rate-limited stateless OpenRouter gateway.
// Secrets never go into Electron or GitHub. No chat history/prompts stored in Supabase.
import {createClient} from "npm:@supabase/supabase-js@2.95.0";

const url=Deno.env.get("SUPABASE_URL")||"";
const pub=Deno.env.get("SUPABASE_ANON_KEY")||"";
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const key=Deno.env.get("BLORP_OPENROUTER_API_KEY")||"";
const model="openai/gpt-4o-mini";
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store",
  "x-content-type-options":"nosniff","access-control-allow-origin":"*",
  "access-control-allow-methods":"POST, OPTIONS","access-control-allow-headers":"authorization,apikey,content-type,x-client-info"};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const denied=(msg:string,status=400)=>reply({error:msg},status);
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers});
 if(req.method!=="POST")return denied("POST required",405);
 if(!url||!pub||!secret)return denied("Cloud AI service unavailable",503);
 const bearer=/^Bearer ([\w.\-+/=]{40,8192})$/.exec(req.headers.get("authorization")||"");
 if(!bearer)return denied("Sign in required",401);
 if(Number(req.headers.get("content-length")||"0")>11000)return denied("Request too large",413);
 let body:Record<string,unknown>;
 try{
   const raw=await req.text();
   if(raw.length>11000)throw Error("Too large");
   const parsed=JSON.parse(raw);
   if(!parsed||typeof parsed!=="object"||Array.isArray(parsed))throw Error("Invalid body");
   body=parsed as Record<string,unknown>;
 }catch{return denied("Invalid request",400)}
 const auth=createClient(url,pub,{auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
   const {data,error}=await auth.auth.getUser(bearer[1]);
   if(error||!data.user||data.user.is_anonymous)return denied("Valid user account required",401);
   const userId=data.user.id;
   if(body.action==="status"){
     const [m,u]=await Promise.all([
       admin.from("blorp_memberships").select("plan,expires_at").eq("user_id",userId).maybeSingle(),
       admin.from("blorp_ai_daily_usage").select("requests").eq("user_id",userId).eq("usage_day",new Date().toISOString().slice(0,10)).maybeSingle()
     ]);
     if(m.error||u.error)throw Error("database");
     const active=Boolean(m.data?.expires_at&&Date.parse(m.data.expires_at)>Date.now());
     const plan=active?m.data?.plan:"free";
     const limit=plan==="studio"?60:plan==="builder"?20:0;
     return reply({configured:Boolean(key),eligible:limit>0,model,plan,
       daily_limit:limit,remaining:Math.max(0,limit-(u.data?.requests||0))});
   }
   if(body.action!=="chat")return denied("Unsupported action",404);
   if(!key)return denied("Cloud AI has not been configured by the Owner",503);
   if(!Array.isArray(body.messages)||body.messages.length<1||body.messages.length>10)return denied("Invalid message list",400);
   let total=0;
   const messages:{role:"user"|"assistant";content:string}[]=[];
   for(const raw of body.messages){
     if(!raw||typeof raw!=="object")return denied("Invalid message",400);
     const role=(raw as {role?:unknown}).role,content=(raw as {content?:unknown}).content;
     if((role!=="user"&&role!=="assistant")||typeof content!=="string"||!content.trim()||content.length>3500)return denied("Invalid message content",400);
     total+=content.length;
     messages.push({role,content:content.trim()});
   }
   if(total>7500||messages[messages.length-1].role!=="user")return denied("Message limits exceeded",400);
   const {data:meter,error:meterError}=await admin.rpc("blorp_ai_try_consume",{p_user_id:userId});
   if(meterError)throw Error("quota");
   if(!meter?.allowed)return denied(meter?.reason==="daily_limit"?"Daily cloud AI limit reached":"Builder or Studio membership required",429);
   const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),35000);
   try{
     const resp=await fetch("https://openrouter.ai/api/v1/chat/completions",{
       method:"POST",redirect:"error",signal:abort.signal,
       headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json",
         "HTTP-Referer":"https://github.com/dilu-dot/BLORP","X-Title":"Blorp AI"},
       body:JSON.stringify({model,stream:false,max_tokens:650,temperature:0.5,
         messages:[{role:"system",content:"You are Blorp AI. Give practical, concise assistance with software, coding and design. You cannot run code, access the user's files, or claim tests passed."},...messages]})
     });
     if(!resp.ok)return denied("Cloud provider is temporarily unavailable. Request counts may include failed attempts.",502);
     const raw=await resp.text();
     if(raw.length>100000)return denied("Provider response too large",502);
     const result=JSON.parse(raw),answer=result?.choices?.[0]?.message?.content;
     if(typeof answer!=="string"||!answer.trim())return denied("Provider returned no text",502);
     return reply({answer:answer.slice(0,14000),model,remaining:meter.remaining,source:"cloud",
       message:"Cloud AI inference processed a temporary prompt; no chat history was stored in Supabase."});
   }catch{return denied("Cloud provider timeout or unavailable. Request counts may include failed attempts.",502)}
   finally{clearTimeout(timer)}
 }catch{
   return denied("Cloud AI backend temporarily unavailable",503);
 }
});
