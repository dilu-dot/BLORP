"use strict";
/** Installed-app OAuth: system browser + randomized loopback callback + PKCE.
 * No client secret or Google access/refresh tokens are saved by this module.
 */
const {randomBytes, createHash} = require("node:crypto");
const http = require("node:http");

function isGoogleDesktopId(value) {
  return typeof value === "string" &&
    /^\d+-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value);
}
function randomUrlSafe(n = 32) { return randomBytes(n).toString("base64url"); }
function html(response, status, text) {
  response.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
    "Referrer-Policy": "no-referrer"
  });
  response.end("<!doctype html><html><meta charset=utf-8><title>Blorp AI sign in</title><style>body{background:#09201f;color:#f5f2e8;font:16px system-ui;text-align:center;padding:70px}</style><h2>" + text + "</h2><p>Return to Blorp AI.</p></html>");
}
async function authorizeWithGoogle({clientId, openExternal, fetchToken = fetch, timeoutMs = 150000}) {
  if (!isGoogleDesktopId(clientId)) throw Error("Google Desktop OAuth client ID is not configured correctly.");
  if (typeof openExternal !== "function") throw Error("Desktop system-browser integration is unavailable.");
  const state = randomUrlSafe();
  const nonce = randomUrlSafe();
  const verifier = randomUrlSafe(48);
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  let settle;
  let fail;
  let accepted = false;
  const codeReceived = new Promise((resolve, reject) => {settle = resolve; fail = reject;});
  const server = http.createServer((req, response) => {
    if (req.method !== "GET" || !req.url || req.url.length > 4096) {
      response.writeHead(405); response.end(); return;
    }
    let url;
    try {url = new URL(req.url, "http://127.0.0.1");}
    catch {response.writeHead(400);response.end();return;}
    if (url.pathname !== "/oauth2redirect") {response.writeHead(404);response.end();return;}
    if (url.searchParams.get("state") !== state) {
      html(response, 400, "Invalid sign-in request"); return;
    }
    if (accepted) {html(response, 409, "Sign-in already received");return;}
    const error = url.searchParams.get("error");
    const code = url.searchParams.get("code");
    if (error) {
      accepted = true; html(response, 200, "Sign-in was cancelled");
      fail(Error("Google sign-in was cancelled or denied."));return;
    }
    if (!code || code.length > 2048) {
      html(response, 400, "Invalid Google authorization response");return;
    }
    accepted = true;
    html(response, 200, "Google confirmation received");
    settle(code);
  });
  let timer;
  try {
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const redirectUri = "http://127.0.0.1:" + server.address().port + "/oauth2redirect";
    const authorization = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    for(const [key,value] of Object.entries({
      client_id: clientId, redirect_uri: redirectUri, response_type: "code",
      scope: "openid email profile", state, nonce,
      code_challenge: challenge, code_challenge_method: "S256"
    })) authorization.searchParams.set(key, value);
    const timeout = new Promise((_,reject)=>{
      timer = setTimeout(()=>reject(Error("Google sign-in timed out. Try again.")),timeoutMs);
    });
    await openExternal(authorization.toString());
    const code = await Promise.race([codeReceived,timeout]);
    const controller = new AbortController();
    const timeoutToken = setTimeout(()=>controller.abort(),15000);
    let response;
    try {
      response = await fetchToken("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({
          client_id: clientId, redirect_uri: redirectUri,
          code, grant_type: "authorization_code", code_verifier: verifier
        }),
        signal: controller.signal
      });
    } finally {clearTimeout(timeoutToken);}
    const token = await response.json();
    if (!response.ok || typeof token.id_token !== "string" || token.id_token.length > 8000)
      throw Error("Google could not complete sign-in. Check OAuth configuration.");
    let claims;
    try {claims = JSON.parse(Buffer.from(token.id_token.split(".")[1],"base64url").toString("utf8"));}
    catch {throw Error("Invalid Google identity response.");}
    if (claims.nonce !== nonce || claims.aud !== clientId)
      throw Error("Google identity response does not match this request.");
    // Backend must independently verify Google's signature, expiry, audience, and issuer.
    return {credential: token.id_token};
  } finally {
    if (timer) clearTimeout(timer);
    server.close();
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
  }
}
module.exports = {authorizeWithGoogle,isGoogleDesktopId};
