"use strict";
// Limited, single-purpose bridge. No Node, filesystem, or arbitrary IPC exposed to pages.
const {contextBridge, ipcRenderer} = require("electron");
contextBridge.exposeInMainWorld("blorpStudio", Object.freeze({
  invoke: (operation,payload) => ipcRenderer.invoke("blorp:studio",operation,payload)
}));
contextBridge.exposeInMainWorld("blorpCloud", Object.freeze({
  invoke: (operation,payload) => ipcRenderer.invoke("blorp:cloud",operation,payload)
}));
