"use strict";
// Limited, single-purpose bridge. No Node, filesystem, or arbitrary IPC exposed to pages.
const {contextBridge, ipcRenderer} = require("electron");
contextBridge.exposeInMainWorld("blorpDesktopGoogle", Object.freeze({
  begin: () => ipcRenderer.invoke("blorp:google:authorize")
}));
