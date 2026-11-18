"use strict";
// Limited, single-purpose bridge. No Node, filesystem, or arbitrary IPC exposed to pages.
const {contextBridge, ipcRenderer} = require("electron");
contextBridge.exposeInMainWorld("blorpStudio", Object.freeze({
  invoke: (operation,payload) => ipcRenderer.invoke("blorp:studio",operation,payload),
  onInstallProgress: (callback) => {
    if(typeof callback!=="function")return ()=>{};
    const handler=(_event,detail)=>callback(detail);
    ipcRenderer.on("blorp:model-progress",handler);
    return ()=>ipcRenderer.removeListener("blorp:model-progress",handler);
  }
}));
contextBridge.exposeInMainWorld("blorpCloud", Object.freeze({
  invoke: (operation,payload) => ipcRenderer.invoke("blorp:cloud",operation,payload)
}));
