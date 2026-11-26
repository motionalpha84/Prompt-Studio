const {app,BrowserWindow,ipcMain,dialog,protocol,net,shell,Menu,Tray,globalShortcut,clipboard,nativeTheme}=require('electron');
const path=require('node:path');
const fs=require('node:fs/promises');
const {pathToFileURL}=require('node:url');
const {randomUUID}=require('node:crypto');

protocol.registerSchemesAsPrivileged([{scheme:'cixu',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
app.setName('词序');
app.setPath('userData',process.env.CIXU_DATA_DIR?path.resolve(process.env.CIXU_DATA_DIR):path.join(app.getPath('appData'),'CixuPromptStudio'));
let window,store,tray,quitting=false,closeApproved=false,currentShortcut='',recordingShortcut=false;
const staged=new Map();
const primary=app.requestSingleInstanceLock();
if(!primary)app.quit();
app.on('second-instance',()=>showWindow());
function showWindow(){if(!window)return;if(window.isMinimized())window.restore();window.show();window.focus();}
function bindShortcut(shortcut){
  if(typeof shortcut!=='string'||!shortcut||shortcut.length>100)throw new Error('快捷键格式无效。');
  if(shortcut===currentShortcut)return;
  // Electron treats aliases and reordered modifiers as the same registration.
  if(currentShortcut && globalShortcut.isRegistered(shortcut))return;
  let ok=false;try{ok=globalShortcut.register(shortcut,()=>{
    if(recordingShortcut && window.isFocused())window.webContents.send('cixu:recorded-shortcut',currentShortcut);
    else if(window.isVisible()&&window.isFocused())window.hide();
    else showWindow();
  });}catch{}
  if(!ok)throw new Error('该快捷键不可用或已被其他程序占用，请换一个组合。');
  if(currentShortcut)globalShortcut.unregister(currentShortcut);
  currentShortcut=shortcut;
}
app.on('before-quit',()=>{quitting=true;});
app.on('will-quit',()=>{globalShortcut.unregisterAll();try{store?.close();}catch{}});
app.on('window-all-closed',()=>app.quit());

async function start(){
  const {Store}=await import('../core/store.mjs');
  const {importRows,toCSV}=await import('../core/csv.mjs');
  store=new Store(app.getPath('userData'),path.join(__dirname,'../resources'));
  const initial=store.init();
  const applyTheme=theme=>{nativeTheme.themeSource=['light','dark','system'].includes(theme)?theme:'system';};
  applyTheme(initial.workspace.settings.theme);
  protocol.handle('cixu',async request=>{
    try{
      const u=new URL(request.url);if(u.hostname!=='app')return new Response('Not found',{status:404});
      const root=path.resolve(__dirname,'../dist'),file=path.resolve(root,decodeURIComponent(u.pathname.slice(1))||'index.html');
      if(file!==root&&!file.startsWith(root+path.sep))return new Response('Forbidden',{status:403});
      return net.fetch(pathToFileURL(file).toString());
    }catch{return new Response('Not found',{status:404});}
  });
  const methods={
    'app.init':()=>({...store.init(),version:app.getVersion(),shortcutAvailable:!!currentShortcut,themeSource:nativeTheme.themeSource}),
    'state.save':({workspace})=>{
      const old=store.get('workspace')?.settings;
      // Draft autosaves can arrive while the recorder is confirming a change.
      if(old?.shortcut)workspace.settings.shortcut=old.shortcut;
      const result=store.saveWorkspace(workspace);
      window.setAlwaysOnTop(!!workspace.settings.alwaysOnTop);applyTheme(workspace.settings.theme);return result;
    },
    'shortcut.recording':({active})=>{recordingShortcut=active===true;},
    'shortcut.set':({shortcut})=>{
      const workspace=store.get('workspace'),previous=currentShortcut;
      bindShortcut(shortcut);
      try{
        workspace.settings.shortcut=shortcut;
        store.put('workspace',workspace);
      }catch(error){
        if(previous)bindShortcut(previous);
        else if(currentShortcut){globalShortcut.unregister(currentShortcut);currentShortcut='';}
        throw error;
      }
      return shortcut;
    },
    'app.close':()=>{closeApproved=true;window.close();},
    'app.minimize':()=>window.minimize(),
    'app.data':async()=>{const e=await shell.openPath(store.root);if(e)throw new Error(e);},
    'clipboard.write':({text})=>{if(typeof text!=='string'||text.length>1e6)throw new Error('复制内容过长。');clipboard.writeText(text);return true;},
    'tags.select':({source})=>store.selectSource(source),
    'tags.search':args=>store.search(args),
    'tags.lookup':({names})=>store.lookup(names),
    'tags.use':({name})=>store.use(String(name)),
    'tags.favorite':({name})=>({tag:store.favorite(String(name)),stats:store.stats()}),
    'tags.save':args=>({tag:store.saveTag(args),stats:store.stats()}),
    'presets.save':args=>store.savePreset(args),
    'presets.delete':({id})=>store.deletePreset(String(id)),
    'snippets.save':args=>store.saveSnippet(args),
    'snippets.delete':({id})=>store.deleteSnippet(String(id)),
    'history.list':()=>store.history(),
    'history.read':({id})=>store.historyDraft(String(id)),
    'history.snapshot':({draft})=>{store.snapshot(draft);return store.history();},
    'import.preview':async({kind})=>{
      if(!['tags','translations','backup'].includes(kind))throw new Error('导入类型无效。');
      const result=await dialog.showOpenDialog(window,{title:kind==='backup'?'选择词序 JSON 备份':kind==='translations'?'选择中英翻译 CSV（两列或旧三列）':'选择 Tag Autocomplete 格式的 CSV',properties:['openFile'],filters:[{name:kind==='backup'?'词序备份':'CSV 词库',extensions:[kind==='backup'?'json':'csv']}]});
      if(result.canceled)return null;
      const file=result.filePaths[0],stat=await fs.stat(file);if(stat.size>(kind==='backup'?512:120)*1024*1024)throw new Error('文件超过导入大小限制。');
      const buffer=await fs.readFile(file);let text;
      if(buffer[0]===0xff&&buffer[1]===0xfe)text=buffer.subarray(2).toString('utf16le');else text=buffer.toString('utf8');
      if(text.includes('\uFFFD'))throw new Error('文件编码无法识别，请先保存为 UTF-8 编码的 CSV。');
      const parsed=kind==='backup'?{backup:store.validateBackup(JSON.parse(text))}:importRows(text,kind);
      if(kind!=='backup'&&!parsed.entries.length)throw new Error('没有找到可导入的数据，请检查所选导入类型和文件列。');
      const token=randomUUID();staged.clear();staged.set(token,{kind,parsed,source:store.source});
      const existing=kind==='backup'?0:parsed.entries.filter(e=>store.byName.has(e.name.toLowerCase().replaceAll('_',' '))).length;
      return {token,kind,filename:path.basename(file),total:kind==='backup'?parsed.backup.tags.length+(parsed.backup.gelbooruTags?.length||0):parsed.entries.length,skipped:parsed.skipped||0,existing,preview:kind==='backup'?[]:parsed.entries.slice(0,10),drafts:parsed.backup?.workspace.drafts.length||0};
    },
    'import.commit':({token})=>{const value=staged.get(token);if(!value)throw new Error('导入预览已过期，请重新选择文件。');staged.delete(token);if(value.kind!=='backup' && value.source!==store.source)throw new Error('词库已切换，请重新预览。');if(value.kind==='backup')return {restored:store.restore(value.parsed.backup)};return {stats:store.import(value.parsed.entries,value.kind)};},
    'export.file':async({kind})=>{
      if(!['backup','tags','translations'].includes(kind))throw new Error('导出类型无效。');
      const stamp=new Date().toISOString().slice(0,10),result=await dialog.showSaveDialog(window,{title:'导出数据',defaultPath:`词序-${kind==='backup'?'完整备份':kind==='tags'?store.source+'-标签词库':store.source+'-中文翻译'}-${stamp}.${kind==='backup'?'json':'csv'}`,filters:[{name:kind==='backup'?'JSON 备份':'CSV',extensions:[kind==='backup'?'json':'csv']}]});
      if(result.canceled)return null;
      const text=kind==='backup'?JSON.stringify(store.backup()):kind==='tags'?toCSV([['name','category','count','aliases','translation'],...store.memory.map(t=>[t.name,t.category,t.count,t.aliases.join(','),t.translation])]):toCSV([['english','translation'],...store.memory.filter(t=>t.translation).map(t=>[t.name,t.translation])]);
      const tmp=result.filePath+'.'+randomUUID()+'.tmp';await fs.writeFile(tmp,text,'utf8');await fs.rename(tmp,result.filePath);return {filename:path.basename(result.filePath)};
    },
  };
  ipcMain.handle('cixu:call',async(event,method,args)=>{
    try{if(event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw new Error('不受信任的请求。');if(!Object.hasOwn(methods,method))throw new Error('不支持的操作。');return {ok:true,value:await methods[method](args||{})};}catch(e){return {ok:false,error:e.message||'操作失败。'};}
  });
  Menu.setApplicationMenu(null);
  window=new BrowserWindow({width:1580,height:980,minWidth:1060,minHeight:680,show:false,title:'词序 · Prompt Studio',backgroundColor:'#101315',icon:path.join(__dirname,'../resources/icon.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',e=>e.preventDefault());
  window.webContents.on('did-start-loading',()=>{recordingShortcut=false;});
  window.webContents.session.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
  window.setAlwaysOnTop(!!initial.workspace.settings.alwaysOnTop);
  window.on('close',event=>{
    if(closeApproved)return;
    event.preventDefault();
    if(!quitting&&store.get('workspace')?.settings.closeToTray){window.webContents.send('cixu:closing','tray');window.hide();return;}
    window.webContents.send('cixu:closing');
  });
  if(process.env.CIXU_HEADLESS!=='1'){
    tray=new Tray(path.join(__dirname,'../resources/icon.png'));tray.setToolTip('词序 · 提示词工作台');
    tray.setContextMenu(Menu.buildFromTemplate([{label:'打开词序',click:showWindow},{type:'separator'},{label:'退出',click:()=>{quitting=true;window.webContents.send('cixu:closing');}}]));
    tray.on('double-click',showWindow);
    try{bindShortcut(initial.workspace.settings.shortcut);}catch{}
    try{store.writeAutoBackup();}catch(e){console.error('自动备份失败',e);}
  }
  window.once('ready-to-show',()=>{if(process.env.CIXU_HEADLESS!=='1')window.show();});
  await window.loadURL(process.env.CIXU_DEV_URL||'cixu://app/index.html');
}
if(primary)app.whenReady().then(start).catch(error=>{if(process.env.CIXU_HEADLESS==='1')console.error(error);else dialog.showErrorBox('词序启动失败',error.message);app.exit(1);});
