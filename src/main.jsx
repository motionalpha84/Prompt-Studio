import React, {useState,useEffect,useRef,useCallback} from 'react';
import {createRoot} from 'react-dom/client';
import {Library as LibraryIcon,Bookmark,History as HistoryIcon,ArrowDownUp,Pin,PinOff,Monitor,Moon,Sun,Settings as SettingsIcon,PanelLeftClose,PanelLeftOpen,Menu,ScanEye,Save,Copy,GripVertical,FileText,Undo2,Redo2,Search,Camera,CopyPlus,Plus,Keyboard,X,CircleCheck,CircleAlert,ImagePlus} from 'lucide-react';
import {parseField,newDraft,newGroup,hydrateDraft,normalize,insertText,outputField,outputSeparator,withTrailingTagComma,formatLibraryTag,uid} from '../core/prompt.mjs';
import {defaultSettings} from '../core/seed.mjs';
import {GroupEditor} from './GroupEditor.jsx';
import {TagView,dictionaryKey} from './TagView.jsx';
import {LibraryPanel,PresetsPanel,HistoryPanel,DataPanel,SOURCES,PAGE} from './Library.jsx';
import {SettingsDialog} from './Settings.jsx';
import {IconButton,Modal,num,LINE_HEIGHT} from './ui.jsx';
import './fonts.css';
import './style.css';
const api=window.cixu;
const SECTION={tags:['LIBRARY','我的词库'],presets:['PRESETS','方案库'],history:['HISTORY','历史记录'],data:['IMPORT · EXPORT','导入与导出']};
const RAIL=[['tags',LibraryIcon,'词库'],['presets',Bookmark,'方案'],['history',HistoryIcon,'历史']];
const THEMES={system:[Monitor,'跟随系统','dark'],dark:[Moon,'深色','light'],light:[Sun,'浅色','system']};
// Settings added by this theme; older workspaces get these until the user changes them.

function RailButton({icon:Icon,label,on=false,...props}){return <button type="button" className={'rail-btn'+(on?' on':'')} data-tip={label} aria-label={label} aria-pressed={on} {...props}><Icon size={19}/></button>;}
function TagForm({value,onSave,onClose,categories}){
  const [form,setForm]=useState({name:value?.name||'',translation:value?.translation||'',translationKind:value?.translation_kind||'zh',translationSource:value?.translation_source||'',category:value?.category||'自定义',aliases:value?.aliases?.join(', ')||'',note:value?.note||''});const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const input=(key,label,placeholder='')=><label className="field">{label}<input value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} placeholder={placeholder} maxLength={key==='name'?500:key==='translationSource'?5000:1000}/></label>;
  return <Modal title={value?.name&&value.translation!==undefined?'编辑词条':'新建词条'} subtitle="中文释义、别名和备注都保存在你的个人词库。" onClose={onClose}><form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await onSave({...form,aliases:form.aliases.split(/[,，]/).map(s=>s.trim()).filter(Boolean)});}catch(e){setError(e.message);}finally{setBusy(false);}}}>
    <div className="form-grid">{input('name','英文标签','例如 long_hair')}{input('translation','中文释义或注记','例如 长发')}<label className="field">中文内容类型<select value={form.translationKind} onChange={e=>setForm({...form,translationKind:e.target.value})}><option value="zh">中文释义</option><option value="说明">中文说明</option><option value="原名/身份标注">原名/身份注记</option></select></label>{input('translationSource','内容来源','可选来源记录')}<label className="field">分类<input aria-label="分类" value={form.category} list="categories" onChange={e=>setForm({...form,category:e.target.value})}/></label><datalist id="categories">{categories.map(c=><option key={c}>{c}</option>)}</datalist>{input('aliases','检索别名','多个别名用逗号分隔')}</div>
    <label className="field">备注<textarea rows={3} value={form.note} maxLength={3000} onChange={e=>setForm({...form,note:e.target.value})} placeholder="记录这个标签的用法或适用模型"/></label>{error&&<p className="form-error">{error}</p>}
    <footer><button type="button" className="btn" onClick={onClose}>取消</button><button className="btn primary" disabled={busy}>{busy?'保存中…':'保存词条'}</button></footer></form></Modal>;
}
function SavePreset({draft,existing,onSave,onClose}){
  const [form,setForm]=useState({name:existing?.name||draft.title,category:existing?.category||'人物练习',note:existing?.note||'',cover:existing?.cover||''}),[error,setError]=useState(''),[busy,setBusy]=useState(false);const file=useRef(null);
  return <Modal title={existing?'编辑方案':'保存提示词方案'} subtitle="保存全部提示词组、分行、权重和隐藏状态。" onClose={onClose}><form className="form" onSubmit={async e=>{e.preventDefault();setBusy(true);try{await onSave({...form,id:existing?.id,draft:existing?.draft||draft});}catch(e){setError(e.message);}finally{setBusy(false);}}}>
    <div className="cover-row"><button type="button" className="cover-pick" onClick={()=>file.current.click()}>{form.cover?<img src={form.cover} alt="方案封面"/>:<><ImagePlus size={22}/><span>参考图</span></>}</button><input ref={file} type="file" hidden accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files[0];if(!f)return;if(f.size>3*1024*1024){setError('参考图请控制在 3 MB 以内。');return;}if(!['image/png','image/jpeg','image/webp'].includes(f.type)){setError('请选择 PNG、JPEG 或 WebP 图片。');return;}const r=new FileReader();r.onload=()=>setForm(p=>({...p,cover:r.result}));r.readAsDataURL(f);}}/>
      <div className="form" style={{flex:1,minWidth:0}}><label className="field">方案名称<input required maxLength={200} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="field">分组<input value={form.category} maxLength={100} onChange={e=>setForm({...form,category:e.target.value})}/></label></div></div>
    {form.cover&&<button type="button" className="text-btn" onClick={()=>setForm({...form,cover:''})}>移除参考图</button>}<label className="field">备注<textarea rows={3} value={form.note} maxLength={3000} onChange={e=>setForm({...form,note:e.target.value})} placeholder="记录适用模型、风格或使用心得"/></label>
    {error&&<p className="form-error">{error}</p>}<footer><button type="button" className="btn" onClick={onClose}>取消</button><button className="btn primary" disabled={busy}>保存方案</button></footer></form></Modal>;
}
function SnippetForm({value,text,onClose,onSave}){
  const [form,setForm]=useState({name:value?.name||'',text:value?.text||text||'',category:value?.category||'常用'}),[error,setError]=useState('');
  return <Modal title={value?'编辑片段':'收藏为片段'} subtitle="片段保存在「词库 › 收藏 › 片段」，插入时保留换行。" onClose={onClose}><form className="form" onSubmit={async e=>{e.preventDefault();try{await onSave({...form,id:value?.id});}catch(e){setError(e.message);}}}>
    <div className="form-grid"><label className="field">片段名称<input value={form.name} required maxLength={200} onChange={e=>setForm({...form,name:e.target.value})}/></label><label className="field">分类<input value={form.category} maxLength={80} onChange={e=>setForm({...form,category:e.target.value})}/></label></div>
    <label className="field">片段内容<textarea rows={6} maxLength={20000} required value={form.text} onChange={e=>setForm({...form,text:e.target.value})}/></label>{error&&<p className="form-error">{error}</p>}
    <footer><button type="button" className="btn" onClick={onClose}>取消</button><button className="btn primary">保存片段</button></footer></form></Modal>;
}
function DraftTabs({drafts,activeId,onSwitch,onRename,onClose,onCreate}){
  const [editing,setEditing]=useState('');
  return <div className="dtabs" role="tablist" aria-label="草稿">
    {drafts.map(d=><div key={d.id} className={'dtab'+(d.id===activeId?' on':'')}>
      {editing===d.id?<input className="dtab-input" aria-label="草稿名称" autoFocus value={d.title} maxLength={200} onChange={e=>onRename(d.id,e.target.value)} onBlur={()=>setEditing('')} onKeyDown={e=>{if(e.key==='Enter'||e.key==='Escape')e.currentTarget.blur();}}/>
        :<button type="button" role="tab" aria-selected={d.id===activeId} title="双击重命名" onClick={()=>onSwitch(d.id)} onDoubleClick={()=>setEditing(d.id)}><i className="dtab-dot"/><span>{d.title}</span></button>}
      <IconButton icon={X} size={12} label={'关闭草稿 '+d.title} onClick={()=>onClose(d.id)}/>
    </div>)}
    <IconButton icon={Plus} label="新建草稿" onClick={onCreate}/>
  </div>;
}

function App(){
  const [workspace,setWorkspace]=useState(null),[stats,setStats]=useState(null),[presets,setPresets]=useState([]),[snippets,setSnippets]=useState([]),[dataDir,setDataDir]=useState(''),[version,setVersion]=useState('');
  const [error,setError]=useState(''),[toast,setToast]=useState(''),[saveStatus,setSaveStatus]=useState('saved'),[savedAt,setSavedAt]=useState('');
  const [source,setSource]=useState('danbooru'),[modal,setModal]=useState(null),[panelOpen,setPanelOpen]=useState(true),[section,setSection]=useState('tags'),[navOpen,setNavOpen]=useState(false);
  const [lib,setLib]=useState({query:'',filter:'',category:'',offset:0,favKind:'tags'}),[list,setList]=useState({items:[],total:0}),[loadingTags,setLoadingTags]=useState(false),[revision,setRevision]=useState(0),[dict,setDict]=useState({});
  const [activeId,setActiveId]=useState(''),[findOpen,setFindOpen]=useState(false),[find,setFind]=useState(''),[replacement,setReplacement]=useState(''),[history,setHistory]=useState([]),[initFailure,setInitFailure]=useState('');
  const current=useRef(null),nodes=useRef(new Map()),toastTimer=useRef(null),saveTimer=useRef(null),closing=useRef(false),undo=useRef(new Map()),request=useRef(0),saveId=useRef(0);
  const notify=useCallback(message=>{setToast(message);clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3400);},[]);
  const safely=async action=>{try{return await action();}catch(e){setError(e.message);return null;}};
  useEffect(()=>{if(!api){setInitFailure('请双击词序 EXE 打开应用。');return;}api.call('app.init').then(result=>{setSource(result.source);setStats(result.stats);setPresets(result.presets);setSnippets(result.snippets);setDataDir(result.dataDir);setVersion(result.version);current.current=result.workspace;setWorkspace(result.workspace);if(!result.shortcutAvailable)notify('全局快捷键未启用，可在设置中重新配置。');}).catch(e=>setInitFailure(e.message));},[]);
  const updateWorkspace=useCallback(updater=>{const next=typeof updater==='function'?updater(current.current):updater;current.current=next;setWorkspace(next);setSaveStatus('pending');},[]);
  const flush=useCallback(async()=>{if(!current.current)return;clearTimeout(saveTimer.current);const n=++saveId.current;setSaveStatus('saving');try{const result=await api.call('state.save',{workspace:current.current});if(n===saveId.current){setSaveStatus('saved');setSavedAt(result.savedAt);}return true;}catch(e){setSaveStatus('error');setError('保存失败：'+e.message);return false;}},[]);
  useEffect(()=>{if(!workspace)return;clearTimeout(saveTimer.current);saveTimer.current=setTimeout(flush,650);return()=>clearTimeout(saveTimer.current);},[workspace,flush]);
  useEffect(()=>api?.onClose(async mode=>{if(closing.current)return;closing.current=true;const ok=await flush();if(ok&&mode!=='tray')await api.call('app.close');closing.current=false;}),[flush]);
  const draft=workspace?.drafts.find(d=>d.id===workspace.activeDraft),settings=workspace&&{...defaultSettings,...workspace.settings};
  const groups=draft?.groups||[],activeGroup=groups.find(g=>g.id===activeId)||groups[0];
  const stack=undo.current.get(draft?.id)||{past:[],future:[]};
  const register=useCallback((id,node)=>{if(node)nodes.current.set(id,node);else nodes.current.delete(id);},[]);
  function updateDraft(patch){updateWorkspace(w=>({...w,drafts:w.drafts.map(d=>d.id===w.activeDraft?{...d,...patch}:d)}));}
  function changeGroups(next,type='',groupId=''){
    const w=current.current,d=w.drafts.find(d=>d.id===w.activeDraft);
    const history=undo.current.get(d.id)||{past:[],future:[]};
    if(!type||history.type!==type||history.groupId!==groupId||Date.now()-history.last>650){
      history.past.push(d.groups);if(history.past.length>100)history.past.shift();
    }
    Object.assign(history,{type,groupId,last:Date.now(),future:[]});undo.current.set(d.id,history);updateDraft({groups:next});
  }
  function patchGroup(id,patch,type){
    const w=current.current, d=w.drafts.find(d=>d.id===w.activeDraft);
    changeGroups(d.groups.map(g=>g.id===id?{...g,...patch}:g),type,id);
  }
  function undoField(redo=false){
    const from=redo?stack.future:stack.past,to=redo?stack.past:stack.future;
    if(!from.length)return;to.push(groups);stack.type='';updateDraft({groups:from.pop()});
  }
  function addText(value,tagName){
    const g=activeGroup,node=nodes.current.get(g.id),caret=node?.selectionStart??g.field.text.length;
    const result=insertText(g.field,caret,value,settings.autoTagSpace);
    patchGroup(g.id,{field:result.field,hidden:false});
    requestAnimationFrame(()=>{const el=nodes.current.get(g.id);el?.focus();el?.setSelectionRange(result.caret,result.caret);});
    if(tagName)api.call('tags.use',{name:tagName}).catch(e=>setError(e.message));
  }
  function addLibraryTag(tag){addText(formatLibraryTag(tag.name,settings),tag.name);}
  function copyText(text,message='已复制到剪贴板'){if(!text){notify('没有可复制的内容');return;}return safely(async()=>{await api.call('clipboard.write',{text});notify(message);});}
  function copyPrompt(g=activeGroup){return copyText(withTrailingTagComma(outputField(g.field,settings)),'已复制「'+g.name+'」');}
  function addGroup(){
    if(groups.length>=100){notify('每份草稿最多 100 组');return;}
    const g=newGroup('提示词组 '+(groups.length+1));changeGroups([...groups,g]);setActiveId(g.id);
    requestAnimationFrame(()=>{const el=nodes.current.get(g.id);el?.focus();el?.scrollIntoView({block:'nearest'});});
  }
  function command(g,action){
    if(action==='snippet')setModal({kind:'snippet',text:outputField(g.field,{...settings,keepTagSpaces:true})});
    else if(action==='copy')copyPrompt(g);
    else setModal({kind:'groupAction',action,id:g.id,name:g.name});
  }
  async function switchSource(next){
    if(next===source)return;
    ++request.current;setList({items:[],total:0});setDict({});
    const r=await api.call('tags.select',{source:next});setSource(r.source);setStats(r.stats);setLib(l=>({...l,category:'',offset:0}));setRevision(n=>n+1);
  }
  function findNext(){
    if(!find)return;
    const g=activeGroup,el=nodes.current.get(g.id);let i=g.field.text.indexOf(find,el?.selectionEnd||0);if(i<0)i=g.field.text.indexOf(find);
    if(i<0){notify('未找到匹配内容');return;}if(g.hidden)patchGroup(g.id,{hidden:false});
    requestAnimationFrame(()=>{const node=nodes.current.get(g.id);node?.focus();node?.setSelectionRange(i,i+find.length);});
  }
  function replaceAll(){
    const g=activeGroup;if(!find||!g.field.text.includes(find)){notify('当前组没有可替换的内容');return;}
    const n=g.field.text.split(find).length-1;patchGroup(g.id,{field:parseField(g.field.text.split(find).join(replacement),g.field)});notify('已替换 '+n+' 处');
  }
  function setSetting(key,value){updateWorkspace(w=>({...w,settings:{...w.settings,[key]:value}}));}
  useEffect(()=>{if(!workspace)return;const n=++request.current;setLoadingTags(true);const t=setTimeout(()=>{api.call('tags.search',{query:lib.query,category:lib.category,filter:lib.filter,offset:lib.offset,limit:PAGE}).then(result=>{if(n===request.current)setList(result);}).catch(e=>setError(e.message)).finally(()=>{if(n===request.current)setLoadingTags(false);});},120);return()=>clearTimeout(t);},[workspace?.activeDraft,lib.query,lib.category,lib.filter,lib.offset,revision]);
  useEffect(()=>{
    if(!draft)return;let live=true;
    const names=[...new Set(groups.flatMap(g=>g.field.lines.flatMap(l=>l.items.map(t=>dictionaryKey(t.value)))))];
    const timer=setTimeout(async()=>{try{const all={};for(let i=0;i<names.length;i+=3000){Object.assign(all,await api.call('tags.lookup',{names:names.slice(i,i+3000)}));if(!live)return;}if(live)setDict(all);}catch(e){if(live)setError(e.message);}},80);
    return ()=>{live=false;clearTimeout(timer);};
  },[draft?.groups,source,revision]);
  // "system" leaves data-theme unset so the stylesheet follows the OS colour scheme.
  useEffect(()=>{if(!workspace)return;const t=settings.theme;if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;else delete document.documentElement.dataset.theme;},[settings?.theme]);
  useEffect(()=>{const handler=e=>{
    if(!draft||modal||e.isComposing||e.keyCode===229||!(e.ctrlKey||e.metaKey))return;
    const key=e.key.toLowerCase();
    if(key===','){e.preventDefault();setModal({kind:'settings'});}
    if(key==='s'){e.preventDefault();flush().then(ok=>{if(ok)notify('草稿已保存');});}
    if(key==='enter'){e.preventDefault();copyPrompt();}
    if(key==='f'){e.preventDefault();setFindOpen(true);requestAnimationFrame(()=>document.querySelector('[aria-label="查找文本"]')?.focus());}
    if((key==='z'||key==='y')&&(e.target.matches('.editor')||!e.target.matches('input,textarea'))){e.preventDefault();undoField(key==='y'||e.shiftKey);}
  };document.addEventListener('keydown',handler);return()=>document.removeEventListener('keydown',handler);},[draft,activeId,modal,settings]);
  useEffect(()=>{if(panelOpen&&section==='history'&&workspace)safely(async()=>{await flush();setHistory(await api.call('history.list'));});},[panelOpen,section,!!workspace]);
  async function favorite(name){const result=await api.call('tags.favorite',{name});setStats(result.stats);setRevision(n=>n+1);setDict(d=>({...d,[normalize(name)]:result.tag}));}
  function startResize(e,type){e.preventDefault();const container=e.currentTarget.parentElement.getBoundingClientRect(),startX=e.clientX,old=type==='sidebar'?sideWidth:settings.editorPercent;const move=ev=>{const value=type==='sidebar'?Math.max(260,Math.min(420,old+ev.clientX-startX)):Math.max(28,Math.min(72,(ev.clientX-container.left)/container.width*100));setSetting(type==='sidebar'?'sidebarWidth':'editorPercent',value);};const up=()=>{document.body.classList.remove('resizing');document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);};document.body.classList.add('resizing');document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);}
  async function importPreview(kind){const result=await api.call('import.preview',{kind});if(result)setModal({kind:'import',value:result});}
  async function commitImport(){if(!await flush())return;const result=await api.call('import.commit',{token:modal.value.token});if(result.restored){const r=result.restored;setSource(r.source);updateWorkspace(r.workspace);setStats(r.stats);setPresets(r.presets);setSnippets(r.snippets);setDict({});undo.current.clear();}else setStats(result.stats);setRevision(n=>n+1);setModal(null);notify('数据导入完成');}
  function exportFile(kind){return safely(async()=>{await flush();const r=await api.call('export.file',{kind});if(r)notify('已导出 '+r.filename);});}
  function switchDraft(id){setActiveId('');updateWorkspace(w=>({...w,activeDraft:id}));}
  function createDraft(value,title){if(workspace.drafts.length>=100){notify('最多支持 100 个草稿，请先关闭部分草稿。');return;}const d=value?{...hydrateDraft(value),id:uid(),title:title||value.title+' · 副本'}:newDraft('未命名草稿 '+(workspace.drafts.length+1));setActiveId('');updateWorkspace(w=>({...w,drafts:[...w.drafts,d],activeDraft:d.id}));}
  function renameDraft(id,title){updateWorkspace(w=>({...w,drafts:w.drafts.map(d=>d.id===id?{...d,title}:d)}));}
  async function closeDraft(id){const d=workspace.drafts.find(d=>d.id===id);setHistory(await api.call('history.snapshot',{draft:d}));const rest=workspace.drafts.filter(d=>d.id!==id);if(!rest.length)rest.push(newDraft());updateWorkspace(w=>({...w,drafts:rest,activeDraft:w.activeDraft===id?rest[0].id:w.activeDraft}));notify('草稿已关闭，可在历史记录中找回');}
  async function loadPreset(p,replace=false){if(replace){await api.call('history.snapshot',{draft});updateDraft({...hydrateDraft(p.draft),id:draft.id,title:p.name});}else createDraft(p.draft,p.name);notify('已载入方案「'+p.name+'」');}
  async function restoreHistory(h){const d=await api.call('history.read',{id:h.id});createDraft(d,h.title+' · 恢复');notify('历史快照已作为新草稿打开');}
  if(!workspace)return <div className="boot"><span className="mark" aria-hidden="true"><i/><i/><i/></span><h1>词序</h1><p>{initFailure||'正在打开你的提示词工作台…'}</p>{initFailure&&<button className="btn" onClick={()=>location.reload()}>重新加载</button>}</div>;
  const sideWidth=Math.max(260,settings.sidebarWidth||272);
  const preview=withTrailingTagComma(groups.filter(g=>!g.hidden).map(g=>outputField(g.field,settings)).filter(Boolean).join(settings.singleLine?outputSeparator(settings):'\n'));
  const visibleCount=groups.filter(g=>!g.hidden).reduce((n,g)=>n+g.field.lines.reduce((m,l)=>m+l.items.filter(t=>!t.disabled).length,0),0);
  const saveText=saveStatus==='saved'?'已自动保存'+(savedAt?' '+new Date(savedAt).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}):''):saveStatus==='saving'?'保存中…':saveStatus==='error'?'保存失败，点击重试':'等待保存';
  const [ThemeIcon,themeName,nextTheme]=THEMES[settings.theme]||THEMES.dark;
  const go=key=>{if(section===key&&panelOpen)setPanelOpen(false);else{setSection(key);setPanelOpen(true);}};
  return <div className={'app'+(navOpen?' nav-open':'')} style={{'--side-w':sideWidth+'px','--editor-pct':settings.editorPercent+'%','--editor-font':settings.fontSize+'px','--editor-line':(settings.fontSize*LINE_HEIGHT).toFixed(2)+'px','--tag-font':settings.tagFontSize+'px'}}>
    <nav className="rail" aria-label="主导航">
      <span className="mark" title="词序" aria-label="词序"><i/><i/><i/></span>
      {RAIL.map(([key,Icon,label])=><RailButton key={key} icon={Icon} label={label} on={panelOpen&&section===key} onClick={()=>go(key)}/>)}
      <span className="rail-sep"/>
      <RailButton icon={ArrowDownUp} label="导入 / 导出" on={panelOpen&&section==='data'} onClick={()=>go('data')}/>
      <div className="spacer"/>
      <RailButton icon={settings.alwaysOnTop?Pin:PinOff} label={api.demo?'窗口置顶（桌面版）':settings.alwaysOnTop?'取消窗口置顶':'窗口置顶'} on={settings.alwaysOnTop} disabled={api.demo} onClick={()=>setSetting('alwaysOnTop',!settings.alwaysOnTop)}/>
      <RailButton icon={ThemeIcon} label={'主题：'+themeName+'，点击切换'} onClick={()=>setSetting('theme',nextTheme)}/>
      <RailButton icon={SettingsIcon} label="设置 · Ctrl+," on={modal?.kind==='settings'} onClick={()=>setModal({kind:'settings'})}/>
      <button type="button" className={'save-state '+saveStatus} title={saveText} aria-label={saveText} onClick={saveStatus==='error'?flush:undefined}><i className={'save-dot '+saveStatus}/></button>
    </nav>
    {panelOpen&&<aside className="side" aria-label={SECTION[section][1]}>
      <div className="side-head"><div><span className="eyebrow">{SECTION[section][0]}</span><h2>{SECTION[section][1]}</h2></div><div className="spacer"/><IconButton icon={PanelLeftClose} label="收起面板" onClick={()=>{setPanelOpen(false);setNavOpen(false);}}/></div>
      {section==='tags'&&<LibraryPanel api={api} lib={lib} setLib={setLib} list={list} loading={loadingTags} stats={stats} source={source} snippets={snippets} onError={e=>setError(e.message)}
        onSwitchSource={s=>safely(()=>switchSource(s))} onInsertTag={addLibraryTag} onInsertText={text=>addText(text)} onFavorite={name=>safely(()=>favorite(name))}
        onEditTag={tag=>setModal({kind:'tag',value:tag||undefined})} onEditSnippet={s=>setModal({kind:'snippet',value:s||undefined})}/>}
      {section==='presets'&&<PresetsPanel presets={presets} onLoad={(p,replace)=>safely(()=>loadPreset(p,replace))} onEdit={p=>setModal({kind:'savePreset',value:p})} onDelete={p=>setModal({kind:'deletePreset',value:p})} onSaveCurrent={()=>setModal({kind:'savePreset'})}/>}
      {section==='history'&&<HistoryPanel history={history} onRestore={h=>safely(()=>restoreHistory(h))} onSnapshot={()=>safely(async()=>{setHistory(await api.call('history.snapshot',{draft}));notify('已创建快照');})}/>}
      {section==='data'&&<DataPanel source={source} demo={api.demo} onImport={kind=>safely(()=>importPreview(kind))} onExport={exportFile} onOpenData={()=>safely(()=>api.call('app.data'))}/>}
      <div className="side-resize" title="拖动调整宽度" onPointerDown={e=>startResize(e,'sidebar')}/>
    </aside>}
    <main className="main">
      <div className="topbar">
        <IconButton icon={Menu} className="mnav" label="打开导航" onClick={()=>{setPanelOpen(true);setNavOpen(true);}}/>
        {!panelOpen&&<IconButton icon={PanelLeftOpen} className="dnav" label="展开面板" onClick={()=>setPanelOpen(true)}/>}
        <DraftTabs drafts={workspace.drafts} activeId={draft.id} onSwitch={switchDraft} onRename={renameDraft} onClose={id=>safely(()=>closeDraft(id))} onCreate={()=>createDraft()}/>
        <div className="spacer"/>
        <span className="meta">{groups.length} 组 · {visibleCount} 标签</span>
        <button type="button" className="btn ghost" onClick={()=>setModal({kind:'preview'})}><ScanEye size={15}/><span className="lbl">预览输出</span></button>
        <button type="button" className="btn" onClick={()=>setModal({kind:'savePreset'})}><Save size={15}/><span className="lbl">保存方案</span></button>
        <button type="button" className="btn primary" title="按组顺序复制所有可见提示词" onClick={()=>copyText(preview,'已复制全部输出')}><Copy size={15}/><span className="lbl">复制全部</span></button>
      </div>
      <div className="split">
        <section className="pane editor-pane">
          <header className="pane-head"><div className="pane-title"><FileText size={15}/>提示词</div><div className="spacer"/>
            <IconButton icon={Undo2} label="撤销 · Ctrl+Z" disabled={!stack.past.length} onClick={()=>undoField()}/><IconButton icon={Redo2} label="重做 · Ctrl+Y" disabled={!stack.future.length} onClick={()=>undoField(true)}/>
            <IconButton icon={Search} label="查找和替换 · Ctrl+F" active={findOpen} onClick={()=>setFindOpen(!findOpen)}/><IconButton icon={Camera} label="创建历史快照" onClick={()=>safely(async()=>{setHistory(await api.call('history.snapshot',{draft}));notify('已创建快照');})}/><IconButton icon={CopyPlus} label="复制为新草稿" onClick={()=>createDraft(draft)}/>
          </header>
          {findOpen&&<div className="findbar"><input aria-label="查找文本" placeholder="在当前组查找" value={find} onChange={e=>setFind(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')findNext();}}/><input aria-label="替换文本" placeholder="替换为" value={replacement} onChange={e=>setReplacement(e.target.value)}/><button type="button" className="btn sm" onClick={findNext}>查找</button><button type="button" className="btn sm" disabled={!find} onClick={replaceAll}>全部替换</button><IconButton icon={X} label="关闭查找" onClick={()=>setFindOpen(false)}/></div>}
          <div className="groups">{groups.map((g,i)=><GroupEditor key={draft.id+g.id} group={g} index={i} active={activeGroup.id===g.id} single={groups.length===1} api={api} source={source} sourceLabel={SOURCES[source]?.label||source} settings={settings} register={register}
            onError={e=>setError(e.message)} onActivate={()=>setActiveId(g.id)} onChange={(patch,type)=>patchGroup(g.id,patch,type)} onCommand={action=>command(g,action)}/>)}</div>
          <div className="groups-foot"><button type="button" className="btn sm soft" onClick={addGroup}><Plus size={14}/>新建提示词组</button><button type="button" className="text-btn" onClick={()=>setModal({kind:'help'})}><Keyboard size={13}/>操作提示</button></div>
        </section>
        <div className="splitter" title="拖动调整左右比例" onPointerDown={e=>startResize(e,'editor')}><GripVertical size={14}/></div>
        <TagView key={draft.id} groups={groups} dict={dict} settings={settings} onChange={changeGroups} onCopy={copyText} onSnippet={text=>setModal({kind:'snippet',text})}
          onEditMeaning={(tag,info)=>setModal({kind:'tag',value:info||{name:dictionaryKey(tag.value).replaceAll(' ','_')}})} onFavorite={(tag,info)=>safely(async()=>{if(!info){const r=await api.call('tags.save',{name:dictionaryKey(tag.value).replaceAll(' ','_')});info=r.tag;}await favorite(info.name);})}/>
      </div>
    </main>
    <div className="scrim" onClick={()=>setNavOpen(false)}/>
    {toast&&<div role="status" className="toast"><CircleCheck size={15}/>{toast}</div>}{error&&<div role="alert" className="error-banner"><CircleAlert size={17}/><span>{error}</span><IconButton icon={X} label="关闭错误提示" onClick={()=>setError('')}/></div>}
    {modal?.kind==='settings'&&<SettingsDialog api={api} settings={settings} onChange={setSetting} stats={stats} dataDir={dataDir} version={version} demo={api.demo} source={source} sample={groups.find(g=>!g.hidden&&g.field.text.trim())?.field}
      onImport={kind=>safely(()=>importPreview(kind))} onExport={exportFile} onOpenData={()=>safely(()=>api.call('app.data'))} onClose={()=>setModal(null)}/>}
    {modal?.kind==='tag'&&<TagForm value={modal.value} categories={stats.categories} onClose={()=>setModal(null)} onSave={async value=>{const r=await api.call('tags.save',value);setStats(r.stats);setRevision(n=>n+1);setModal(null);notify('词条已保存');}}/>}
    {modal?.kind==='savePreset'&&<SavePreset draft={draft} existing={modal.value} onClose={()=>setModal(null)} onSave={async value=>{await flush();setPresets(await api.call('presets.save',value));setModal(null);notify('方案已保存');}}/>}
    {modal?.kind==='snippet'&&<SnippetForm value={modal.value} text={modal.text} onClose={()=>setModal(null)} onSave={async value=>{setSnippets(await api.call('snippets.save',value));setModal(null);notify(value.id?'片段已更新':'已收藏为片段');}}/>}
    {modal?.kind==='groupAction'&&<Modal title={(modal.action==='delete'?'删除':'清空')+'「'+modal.name+'」？'} subtitle="操作前保存历史快照，也可以使用撤销恢复。" onClose={()=>setModal(null)}><footer><button type="button" className="btn" onClick={()=>setModal(null)}>取消</button><button type="button" className="btn danger" onClick={()=>safely(async()=>{await api.call('history.snapshot',{draft});if(modal.action==='delete'){const next=groups.filter(g=>g.id!==modal.id);changeGroups(next.length?next:[newGroup()]);}else patchGroup(modal.id,{field:parseField('')});setModal(null);})}>确认{modal.action==='delete'?'删除':'清空'}</button></footer></Modal>}
    {modal?.kind==='deletePreset'&&<Modal title={'删除方案「'+modal.value.name+'」？'} subtitle="删除方案不会影响已经打开的草稿。" onClose={()=>setModal(null)}><footer><button type="button" className="btn" onClick={()=>setModal(null)}>取消</button><button type="button" className="btn danger" onClick={()=>safely(async()=>{setPresets(await api.call('presets.delete',{id:modal.value.id}));setModal(null);})}>删除方案</button></footer></Modal>}
    {modal?.kind==='preview'&&<Modal title="输出预览" subtitle="按组顺序合并可见内容，跳过隐藏的组和标签。" wide onClose={()=>setModal(null)}><pre className="preview">{preview||'当前没有启用的提示词。'}</pre><footer><button type="button" className="btn" onClick={()=>setModal(null)}>关闭</button><button type="button" className="btn primary" onClick={()=>copyText(preview,'已复制全部输出')}><Copy size={14}/>复制全部输出</button></footer></Modal>}
    {modal?.kind==='import'&&<Modal title={modal.value.kind==='backup'?'恢复备份预览':'导入预览'} subtitle={modal.value.filename} wide onClose={()=>setModal(null)}><div className="import-stats"><div><b>{num(modal.value.total)}</b><span>{modal.value.kind==='backup'?'备份中的词条':'可导入词条'}</span></div><div><b>{num(modal.value.kind==='backup'?modal.value.drafts:modal.value.existing)}</b><span>{modal.value.kind==='backup'?'草稿':'与现有词库重复'}</span></div><div><b>{modal.value.skipped}</b><span>跳过的无效行</span></div></div>{modal.value.kind==='backup'?<p className="callout">确认后将使用备份替换当前词库、草稿、方案和片段。当前数据会先自动备份到数据目录的 backups 文件夹。</p>:<><div className="import-table"><table><thead><tr><th>英文标签</th><th>中文释义</th><th>分类</th></tr></thead><tbody>{modal.value.preview.map(t=><tr key={t.name}><td>{t.name}</td><td>{t.translation||'—'}</td><td>{t.category||'翻译表'}</td></tr>)}</tbody></table></div><p className="muted-note">仅展示前 10 条。按英文标签合并，保留个人修改和收藏。</p></>}<footer><button type="button" className="btn" onClick={()=>setModal(null)}>取消</button><button type="button" className="btn primary" onClick={()=>safely(commitImport)}>{modal.value.kind==='backup'?'确认恢复备份':'确认导入'}</button></footer></Modal>}
    {modal?.kind==='help'&&<Modal title="编辑与标签操作" onClose={()=>setModal(null)}><div className="help">
      <p>每组可以写多行，同一行放同类标签。<b>Tab</b> 接受补全，<b>Ctrl+Space</b> 手动呼出补全，<b>Ctrl+Enter</b> 复制当前组，<b>Ctrl+F</b> 查找替换，<b>Ctrl+Z / Y</b> 撤销重做，<b>Ctrl+,</b> 打开设置。拖动组底部的横条调节高度。</p>
      <p>单击标签看释义，双击隐藏或启用，右键直接改写原文，回车保存、Esc 取消。扳手按钮打开权重、收藏和括号。空白处按住拖动可以框选多个标签，批量调整权重、隐藏，或收藏为片段。</p>
      <p>框选后，批量操作栏浮在选区下方。拖动任意一个已选标签，整组选中的标签会按原顺序移到青色插入线处，可以跨行、跨组移动。收藏的单个标签和片段都在「词库 › 收藏」里。</p>
    </div></Modal>}
  </div>;
}
class ErrorBoundary extends React.Component {constructor(props){super(props);this.state={error:null};}static getDerivedStateFromError(error){return {error};}render(){return this.state.error?<div className="boot"><CircleAlert size={32}/><h1>界面暂时无法显示</h1><p>{this.state.error.message}</p><button className="btn" onClick={()=>location.reload()}>重新打开界面</button><small>已保存的草稿仍保留在本机。</small></div>:this.props.children;}}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
