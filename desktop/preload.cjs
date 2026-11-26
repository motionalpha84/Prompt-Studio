const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('cixu',{
  call:async(method,args={})=>{const result=await ipcRenderer.invoke('cixu:call',method,args);if(!result.ok)throw new Error(result.error);return result.value;},
  onClose:callback=>{const listener=(_event,mode)=>callback(mode);ipcRenderer.on('cixu:closing',listener);return()=>ipcRenderer.removeListener('cixu:closing',listener);},
  onRecordedShortcut:callback=>{const listener=(_event,shortcut)=>callback(shortcut);ipcRenderer.on('cixu:recorded-shortcut',listener);return()=>ipcRenderer.removeListener('cixu:recorded-shortcut',listener);},
});
