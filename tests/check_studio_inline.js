"use strict";
const fs=require("node:fs");
const vm=require("node:vm");
const assert=require("node:assert/strict");
const html=fs.readFileSync("public/blorp-studio-subscriptions-preview.html","utf8");
let scripts=0, external=0;
const tags=/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
for(const [,attrs,source] of html.matchAll(tags)){
  if(/\bsrc\s*=/.test(attrs)){external++;continue}
  if(/type\s*=\s*["'](?:application\/json|application\/ld\+json)["']/.test(attrs))continue;
  if(!source.trim())continue;
  new vm.Script(source,{filename:"studio-inline-"+(++scripts)+".js",displayErrors:true});
}
assert(scripts>=5,"Expected the premium Studio's multiple inline behavior scripts");
assert(html.includes("studio-backend-bridge.js"),"Missing local auth/projects/Ollama bridge");
assert(html.includes("studio-provider-keys.js"),"Missing secure provider key bridge");
console.log("Studio inline JavaScript parsed: "+scripts+" scripts, "+external+" external references.");
