"use strict";
/** Sequential local-only specialist prompts; model-based review is NOT a real test run. */
function requireText(value,phase){
 if(typeof value!=="string"||!value.trim())throw Error(phase+" returned an empty response");
 return value.trim();
}
async function runAgentBuild({title,brief,model,infer,parseFiles,focus="frontend"}){
 if(!["landing","frontend","threejs","animations"].includes(focus))throw Error("Unsupported build focus");
 if(typeof infer!=="function"||typeof parseFiles!=="function")throw Error("Invalid local agent runtime");
 const plan= requireText(await infer({model,stream:false,options:{temperature:0.3,num_predict:1300},
   messages:[{role:"system",content:"You are Blorp Architect. Plan a responsive, accessible, offline-only static website. Specify sections, content, behavior and styling. Keep under 800 words. No CDNs or remote resources. Do not claim code was tested."},
    {role:"user",content:"Name: "+title+"\nBrief: "+brief}]},"architect").then(x=>x?.message?.content),"Architect");
 const built=await infer({model,stream:false,format:"json",options:{temperature:0.2,num_predict:7500},
   messages:[{role:"system",content:'You are Blorp Builder. Produce ONLY valid JSON {"files":{"index.html":"...","styles.css":"...","script.js":"..."}}. Create a beautiful functional, responsive, dependency-free website. No remote resources, fetch, API, CDN, or secrets; CSS/JS references must be relative. No markdown fences.'},
    {role:"user",content:"Focus: "+focus+"\nName: "+title+"\nBrief: "+brief+"\nArchitect plan:\n"+plan.slice(0,7500)+"\nIf the focus is Three.js, this generator does NOT bundle Three.js. Produce a dependency-free 3D-inspired static site without claiming native Three.js support."}]} ,focus);
 const files=parseFiles(requireText(built?.message?.content,"Builder"));
 const excerpts=Object.entries(files).map(([name,body])=>name+":\n"+body.slice(0,3500)).join("\n\n");
 const review=requireText(await infer({model,stream:false,options:{temperature:0.2,num_predict:950},
   messages:[{role:"system",content:"You are Blorp QA Reviewer. Review the provided static source excerpts for likely errors, accessibility, layout, and security concerns. Provide concrete actionable observations. Do not claim to have run tests or executed code."},
    {role:"user",content:"Project: "+title+"\nBrief: "+brief+"\nFiles:\n"+excerpts}]},"qa").then(x=>x?.message?.content),"QA reviewer");
 return {files,agents:[{role:"Architect",output:plan},{role:"Builder",output:"Generated "+Object.keys(files).join(", ")},{role:"QA Reviewer",output:review}],tested:false};
}
module.exports={runAgentBuild};