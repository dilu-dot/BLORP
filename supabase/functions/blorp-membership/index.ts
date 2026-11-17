// Blorp V5.5 cloud: only account membership, pricing and manual UPI payment records.
// No chat history, model prompts, generated websites, attachments or project files.
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const url = Deno.env.get("SUPABASE_URL") || "";
const publicKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
const secret = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY") || "";
if (!url || !publicKey || !secret) throw Error("Supabase function environment not configured");
const opts = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const identity = createClient(url, publicKey, opts);
const admin = createClient(url, secret, opts);
const headers = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
};
const reply = (payload:unknown, status = 200) => new Response(JSON.stringify(payload), {status, headers});
const bad = (message:string, status = 400) => reply({error:message},status);
const valid = (x:unknown, length=150) => typeof x === "string" && x.length <= length ? x.trim() : "";
const uuid = (x:unknown) => typeof x === "string" && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(x);
const plans = new Set(["builder","studio"]), terms = new Set(["monthly","annual"]);
const priceCodes = new Set(["builder_monthly","builder_annual","studio_monthly","studio_annual"]);

Deno.serve(async req => {
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers});
  if(req.method!=="POST") return bad("POST required",405);
  const match=/^Bearer ([A-Za-z0-9_.+\/=\-]{40,8192})$/.exec(req.headers.get("authorization")||"");
  if(!match) return bad("Supabase Auth session required",401);
  if(Number(req.headers.get("content-length")||"0")>12000) return bad("Request too large",413);
  let body:Record<string,unknown>;
  try {
    const raw=await req.text();
    if(raw.length>12000) return bad("Request too large",413);
    const parsed=JSON.parse(raw);
    if(!parsed || Array.isArray(parsed) || typeof parsed!=="object") throw Error("Invalid JSON");
    body=parsed as Record<string,unknown>;
  }catch{return bad("Invalid JSON body");}
  const action=valid(body.action,60);
  try {
    // Verify the actual user session against Supabase Auth; never trust caller-supplied user ids.
    const {data, error}=await identity.auth.getUser(match[1]);
    if(error || !data.user || data.user.is_anonymous) return bad("Valid verified Supabase account required",401);
    const userId=data.user.id;
    const ownerRow=await admin.from("blorp_owner_accounts").select("user_id").eq("user_id",userId).maybeSingle();
    if(ownerRow.error) throw ownerRow.error;
    const isOwner=Boolean(ownerRow.data);
    if(action==="me"){
      const [membership,requests,prices,payment] = await Promise.all([
        admin.from("blorp_memberships").select("plan,expires_at").eq("user_id",userId).maybeSingle(),
        admin.from("blorp_payment_requests").select("id,plan,term,amount_inr_paise,utr,payer_name,status,created_at,reviewed_at,owner_note").eq("user_id",userId).order("created_at",{ascending:false}).limit(20),
        admin.from("blorp_plan_prices").select("code,amount_inr_paise"),
        admin.from("blorp_payment_config").select("upi_id,qr_image_url").eq("id",true).maybeSingle()
      ]);
      for(const r of [membership,requests,prices,payment]) if(r.error) throw r.error;
      const expires=membership.data?.expires_at ?? null;
      const active=Boolean(expires && Date.parse(expires)>Date.now());
      return reply({user:{id:userId,email:data.user.email},owner:isOwner,plan:active?membership.data?.plan:"free",expires_at:active?expires:null,payment_requests:requests.data,prices:prices.data,payment_config:payment.data});
    }
    if(action==="submit-payment"){
      const plan=valid(body.plan,20),term=valid(body.term,20);
      const utr=valid(body.utr,40).toUpperCase().replace(/\s/g,"");
      const payerName=valid(body.payer_name,100);
      if(!plans.has(plan)||!terms.has(term)||!/^[A-Z0-9-]{8,40}$/.test(utr)) return bad("Invalid plan, term or UTR");
      const [price,payment]=await Promise.all([
        admin.from("blorp_plan_prices").select("amount_inr_paise").eq("code",plan+"_"+term).single(),
        admin.from("blorp_payment_config").select("upi_id").eq("id",true).single(),
      ]);
      if(price.error||payment.error) throw price.error||payment.error;
      const amount=price.data?.amount_inr_paise;
      if(!Number.isInteger(amount) || !payment.data?.upi_id) return bad("Owner has not enabled this payment option",409);
      const {data:created,error:insertError}=await admin.from("blorp_payment_requests").insert({
        user_id:userId,plan,term,utr,payer_name:payerName,amount_inr_paise:amount,status:"pending"
      }).select("id,status,created_at").single();
      if(insertError){
        if(insertError.code==="23505") return bad("Duplicate UTR or existing pending request",409);
        throw insertError;
      }
      // UTR is a claim, not proof of payment.
      return reply({request:created,manual_approval:true,activated:false},201);
    }
    if(!action.startsWith("owner-")) return bad("Unknown action",404);
    if(!isOwner) return bad("Owner access required",403);
    if(action==="owner-dashboard"){
      const [requests,memberships,prices,payment,audit]=await Promise.all([
        admin.from("blorp_payment_requests").select("id,user_id,plan,term,amount_inr_paise,utr,payer_name,status,created_at,reviewed_at,reviewed_by,owner_note").order("created_at",{ascending:false}).limit(200),
        admin.from("blorp_memberships").select("user_id,plan,expires_at,updated_at").order("updated_at",{ascending:false}).limit(200),
        admin.from("blorp_plan_prices").select("code,amount_inr_paise,updated_at"),
        admin.from("blorp_payment_config").select("upi_id,qr_image_url,updated_at").eq("id",true).single(),
        admin.from("blorp_payment_audit").select("request_id,actor_id,action,verified_amount_inr_paise,note,created_at").order("created_at",{ascending:false}).limit(100),
      ]);
      for(const r of [requests,memberships,prices,payment,audit]) if(r.error) throw r.error;
      return reply({requests:requests.data,memberships:memberships.data,prices:prices.data,payment_config:payment.data,audit:audit.data});
    }
    if(action==="owner-approve"){
      const amount=body.verified_amount_inr_paise;
      const note=valid(body.note,500),verifiedUtr=valid(body.verified_utr,40).toUpperCase();
      if(!uuid(body.request_id)||body.statement_confirmed!==true||typeof amount!=="number"||!Number.isInteger(amount)||note.length<8||!/^[A-Z0-9-]{8,40}$/.test(verifiedUtr))
        return bad("Provide exact verified UTR and amount, bank-verification statement and a note");
      const {data:result,error:rpcError}=await admin.rpc("blorp_approve_payment",{
        p_request_id:body.request_id,p_actor_id:userId,p_verified_utr:verifiedUtr,p_verified_amount_inr_paise:amount,p_note:note
      });
      if(rpcError) return bad("Approval denied: already reviewed or verification mismatch",409);
      return reply({approved:result});
    }
    if(action==="owner-reject"){
      const note=valid(body.note,500);
      if(!uuid(body.request_id)||note.length<8) return bad("Valid request ID and rejection note required");
      const {data:result,error:rpcError}=await admin.rpc("blorp_reject_payment",{
        p_request_id:body.request_id,p_actor_id:userId,p_note:note
      });
      if(rpcError) return bad("Request already reviewed or cannot be rejected",409);
      return reply({rejected:result});
    }
    if(action==="owner-set-price"){
      const code=valid(body.code,35),amount=body.amount_inr_paise;
      if(!priceCodes.has(code)||!(amount===null||(typeof amount==="number"&&Number.isInteger(amount)&&amount>=100&&amount<=50000000)))
        return bad("Invalid price code or amount in INR paise");
      const {error}=await admin.from("blorp_plan_prices").update({amount_inr_paise:amount,updated_at:new Date().toISOString()}).eq("code",code);
      if(error) throw error;
      return reply({updated:true});
    }
    if(action==="owner-set-upi"){
      const upiId=valid(body.upi_id,120),qrUrl=valid(body.qr_image_url,500);
      if(upiId && !/^[A-Za-z0-9._-]{2,100}@[A-Za-z0-9.-]{2,40}$/.test(upiId))return bad("Invalid UPI ID");
      if(qrUrl && !qrUrl.startsWith("https://"))return bad("QR URL must be HTTPS");
      const {error}=await admin.from("blorp_payment_config").update({upi_id:upiId,qr_image_url:qrUrl,updated_at:new Date().toISOString()}).eq("id",true);
      if(error) throw error;
      return reply({updated:true});
    }
    return bad("Unknown Owner action",404);
  }catch(error){
    console.error("blorp membership function error",error instanceof Error?error.name:"unknown");
    return bad("Blorp backend temporarily unavailable",503);
  }
});
