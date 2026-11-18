"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");
const main = fs.readFileSync("desktop/main.js", "utf8");
for (const fragment of ["sandbox: true", "nodeIntegration: false", "contextIsolation: true", "https:", "blorp://app/index.html", "persist:blorp-customer"]) {
  assert.ok(main.includes(fragment), "Missing security/desktop feature: " + fragment);
}
for (const file of ["desktop/preload.js", "desktop/google-oauth.js", "public/index.html", "public/assets/base.css", "public/assets/base.js", "public/assets/v53.js"]) {
  assert.ok(fs.existsSync(file), "Missing customer UI: " + file);
}
assert.equal(fs.existsSync("owner-ui"), false, "Private Owner UI must not be copied into customer app");
console.log("Blorp AI desktop source checks passed.");

const {authorizeWithGoogle,isGoogleDesktopId}=require('./google-oauth');
assert.ok(isGoogleDesktopId('1234567-abc.apps.googleusercontent.com'));
assert.equal(isGoogleDesktopId('https://example.com'),false);
assert.ok(fs.readFileSync('public/assets/v52.js','utf8').includes('blorpDesktopGoogle'));
assert.ok(fs.readFileSync('desktop/main.js','utf8').includes('preload.js'));
const http=require('node:http');
(async()=>{
  let callback;
  const fakeClient='1234567-abc.apps.googleusercontent.com';
  const result=await authorizeWithGoogle({
    clientId: fakeClient,
    timeoutMs: 4000,
    openExternal: async raw => {
      const url=new URL(raw);
      assert.equal(url.hostname,'accounts.google.com');
      assert.equal(url.searchParams.get('code_challenge_method'),'S256');
      callback=url;
      const redirect=new URL(url.searchParams.get('redirect_uri'));
      redirect.searchParams.set('state',url.searchParams.get('state'));
      redirect.searchParams.set('code','fake-test-code');
      // Exercise the loopback callback without visiting Google.
      await new Promise((resolve,reject)=>http.get(redirect,resp=>{resp.resume();resp.on('end',resolve)}).on('error',reject));
    },
    fetchToken:async(_url,options)=>{
      assert.equal(options.body.get('code'),'fake-test-code');
      assert.equal(options.body.get('client_id'),fakeClient);
      assert.ok(options.body.get('code_verifier').length>=43);
      const payload=Buffer.from(JSON.stringify({nonce:callback.searchParams.get('nonce'),aud:fakeClient})).toString('base64url');
      return new Response(JSON.stringify({id_token:'header.'+payload+'.sig'}),{status:200});
    }
  });
  assert.ok(result.credential.startsWith('header.'));
  console.log('Google desktop OAuth browser/PKCE simulation passed.');
})().catch(e=>{console.error(e);process.exitCode=1});

const cloud=fs.readFileSync("desktop/cloud-auth.js","utf8");
const ui=fs.readFileSync("public/assets/cloud-desktop.js","utf8");
const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
assert.equal(pkg.version,"0.5.8");
assert.equal(pkg.dependencies["@supabase/supabase-js"],"2.95.0");
assert.ok(pkg.build.files.includes("desktop/cloud-auth.js"));
assert.ok(main.includes('blorp:cloud'));
assert.ok(main.includes('BLORP_USE_LEGACY_BACKEND'));
assert.ok(fs.readFileSync("desktop/preload.js","utf8").includes("blorpCloud"));
assert.ok(fs.readFileSync("public/index.html","utf8").includes("cloud-desktop.js"));
assert.ok(ui.includes("membershipVerified"));
assert.ok(cloud.includes("safeStorage.encryptString"));
assert.ok(cloud.includes("exchangeCodeForSession"));
assert.ok(cloud.includes("piwcwmspjhtalryzpkez"));
assert.ok(!cloud.includes("service_role"));
console.log("Cloud auth source checks passed");

const partitionSource=fs.readFileSync("desktop/main.js","utf8");
assert.ok(partitionSource.includes('appSession.protocol.handle("blorp"'),'Bundled app protocol must be registered on its session');
console.log("Electron session protocol source check passed");

const native=fs.readFileSync("desktop/native-workspace.js","utf8");
assert.ok(native.includes("BlorpWorkspace"));
assert.ok(native.includes("127.0.0.1:11434"));
assert.ok(native.includes('async build('));
assert.ok(native.includes("saveProject"));
assert.ok(main.includes('blorp:studio'));
assert.ok(fs.readFileSync("desktop/preload.js","utf8").includes("blorpStudio"));
assert.ok(fs.readFileSync("public/index.html","utf8").includes("native-studio.js"));
assert.ok(fs.readFileSync("public/assets/native-studio.js","utf8").includes("studioChatForm"));
assert.ok(pkg.build.files.includes("desktop/native-workspace.js"));
console.log("Native workspace source checks passed.");

assert.ok(pkg.build.files.includes('desktop/local-agents.js'));
assert.ok(fs.readFileSync('desktop/native-workspace.js','utf8').includes('runAgentBuild'));
