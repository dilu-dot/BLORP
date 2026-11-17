"use strict";
/**
 * Blorp AI Customer Desktop (developer preview).
 * A standalone Electron window with an offline UI preview.
 * Actual sign-in, payments, and AI building require a backend.
 * The private Blorp Owner desktop app is NOT included.
 */
const {app, BrowserWindow, protocol, net, session, shell, ipcMain} = require("electron");
const {authorizeWithGoogle,isGoogleDesktopId} = require("./google-oauth");
const {pathToFileURL} = require("node:url");
const path = require("node:path");

const PUBLIC = path.resolve(__dirname, "..", "public");
const OFFLINE = "blorp://app/index.html";
const LOCAL_BACKEND = "http://127.0.0.1:8765";
protocol.registerSchemesAsPrivileged([{
  scheme: "blorp",
  privileges: {standard: true, secure: true, supportFetchAPI: true, stream: true}
}]);

function validateOrigin(input) {
  const url = new URL(String(input).trim());
  const local = ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:"))
    throw Error("Remote Blorp servers must use HTTPS");
  if (url.username || url.password || url.hash || url.search || url.pathname !== "/")
    throw Error("Set BLORP_SERVER_URL to a bare HTTPS origin");
  return url.origin;
}

async function health(origin) {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 1800);
  try {
    const response = await fetch(origin + "/api/health", {
      signal: abort.signal, redirect: "error", cache: "no-store"
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data && data.ok === true;
  } catch { return false; }
  finally { clearTimeout(timer); }
}

function registerOfflinePreview() {
  protocol.handle("blorp", async request => {
    let url;
    try { url = new URL(request.url); }
    catch { return new Response("Invalid URL", {status: 400}); }
    if (url.hostname !== "app") return new Response("Not found", {status: 404});
    if (url.pathname.startsWith("/api/")) {
      return new Response(JSON.stringify({
        error: "Offline preview: cloud backend not connected. Login, payments, and AI features are unavailable."
      }), {status: 503, headers: {"Content-Type": "application/json"}});
    }
    let relative;
    try { relative = decodeURIComponent(url.pathname).replace(/^\/+/, "") || "index.html"; }
    catch { return new Response("Invalid path", {status: 400}); }
    if (relative.includes("\0")) return new Response("Invalid path", {status: 400});
    const file = path.resolve(PUBLIC, relative);
    if (!file.startsWith(PUBLIC + path.sep) || !require("node:fs").existsSync(file))
      return new Response("Not found", {status: 404});
    return net.fetch(pathToFileURL(file).toString());
  });
}

function allowedPage(url, backend) {
  try {
    const u = new URL(url);
    if (u.pathname.toLowerCase().startsWith("/owner")) return false;
    return (u.protocol === "blorp:" && u.hostname === "app") ||
      Boolean(backend && u.origin === backend);
  } catch { return false; }
}

function showPreviewNotice(window) {
  window.webContents.executeJavaScript(`(() => {
    if (document.getElementById("blorp-desktop-preview-notice")) return;
    const banner = document.createElement("aside");
    banner.id = "blorp-desktop-preview-notice";
    banner.setAttribute("role", "status");
    banner.textContent = "BLORP DESKTOP PREVIEW · Cloud backend not connected. Sign-in, payments, AI responses and builds require an active backend.";
    banner.style.cssText = "position:fixed;bottom:0;left:0;right:0;z-index:2147483647;padding:11px 18px;background:#122c2b;color:#ffddb5;font:500 13px system-ui,sans-serif;text-align:center;border-top:1px solid #805c38;box-shadow:0 -12px 28px #0008;";
    document.body.appendChild(banner);
  })()`).catch(() => {});
}

app.whenReady().then(async () => {
  registerOfflinePreview();
  const appSession = session.fromPartition("persist:blorp-customer");
  appSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  appSession.setPermissionCheckHandler(() => false);

  let backend = null;
  const configured = process.env.BLORP_SERVER_URL;
  try {
    const origin = validateOrigin(configured || LOCAL_BACKEND);
    if (await health(origin)) backend = origin;
  } catch (error) {
    console.warn("Blorp server configuration invalid:", error.message);
  }

  let oauthInProgress = false;
  let window;
  ipcMain.handle("blorp:google:authorize", async event => {
    if (!window || event.sender !== window.webContents ||
        !allowedPage(window.webContents.getURL(), backend))
      throw Error("Untrusted Google sign-in request.");
    if (!backend) throw Error("A running Blorp backend is needed for Google sign-in.");
    if (oauthInProgress) throw Error("A Google sign-in is already open.");
    oauthInProgress = true;
    try {
      const response = await fetch(backend + "/api/auth/config", {cache:"no-store"});
      if (!response.ok) throw Error("Blorp authentication backend is unavailable.");
      const config = await response.json();
      const clientId = config.google_desktop_client_id;
      if (!isGoogleDesktopId(clientId))
        throw Error("Configure BLORP_GOOGLE_DESKTOP_CLIENT_ID in your backend first.");
      const result = await authorizeWithGoogle({clientId, openExternal: url => shell.openExternal(url)});
      return result.credential;
    } finally {oauthInProgress = false;}
  });
  window = new BrowserWindow({
    title: "Blorp AI",
    width: 1440, height: 900, minWidth: 850, minHeight: 620,
    autoHideMenuBar: true, backgroundColor: "#081a1a",
    webPreferences: {
      partition: "persist:blorp-customer",
      preload: path.join(__dirname, "preload.js"),
      sandbox: true, contextIsolation: true,
      nodeIntegration: false, webSecurity: true
    }
  });

  window.webContents.setWindowOpenHandler(({url}) => {
    try { if (new URL(url).protocol === "https:") shell.openExternal(url); }
    catch {}
    return {action: "deny"};
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!allowedPage(url, backend)) event.preventDefault();
  });
  if (backend) {
    await window.loadURL(backend + "/");
  } else {
    window.webContents.once("did-finish-load", () => showPreviewNotice(window));
    await window.loadURL(OFFLINE);
  }
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
