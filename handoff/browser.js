import fixture from './fixture.json';
import {defaultSettings} from '../core/seed.mjs';
import {newDraft,hydrateDraft,normalize,uid,completionNameRank} from '../core/prompt.mjs';
import {toCSV,importRows} from '../core/csv.mjs';

const key='cixu-frontend-demo-v3';
function initial(){
  const draft=newDraft(fixture.draft.title,fixture.draft.text);
  draft.groups[0].name=fixture.draft.name;
  const tables=Object.fromEntries(Object.entries(fixture.dictionaries).map(([source,rows])=>[source,rows.map((tag,i)=>({...tag,count:tag.count||rows.length-i,aliases:tag.aliases||[],note:tag.note||'',uses:0,favorite:false,custom:0}))]));
  return {source:fixture.source,tables,workspace:{schemaVersion:1,activeDraft:draft.id,drafts:[draft],settings:{...defaultSettings}},presets:[],snippets:fixture.snippets,history:[]};
}
let data=JSON.parse(localStorage.getItem(key)||'null')||initial(),pending;
const persist=()=>localStorage.setItem(key,JSON.stringify(data));
const rows=()=>data.tables[data.source];
const stats=()=>{const notes=rows().filter(t=>t.translation&&t.translation_kind==='说明').length,identity=rows().filter(t=>t.translation&&t.translation_kind==='原名/身份标注').length,pending=rows().filter(t=>!t.translation&&t.translation_kind==='缺口').length;return {total:rows().length,translated:rows().filter(t=>t.translation&&t.translation_kind==='zh').length,notes,identity,annotated:notes+identity,pending,untranslated:rows().filter(t=>!t.translation).length,favorites:rows().filter(t=>t.favorite).length,custom:rows().filter(t=>t.custom).length,categories:[...new Set(rows().map(t=>t.category))].sort((a,b)=>a.localeCompare(b,'zh-CN'))};};
const tag=n=>rows().find(t=>normalize(t.name)===normalize(n));
const init=()=>({...data,workspace:{...data.workspace,drafts:data.workspace.drafts.map(hydrateDraft)},stats:stats(),version:fixture.version||'1.0.0',shortcutAvailable:true,dataDir:'浏览器本地存储 · JSON 演示词库'});
function save(kind,value){const v={...value,id:value.id||uid(),updatedAt:new Date().toISOString()};data[kind]=[v,...data[kind].filter(r=>r.id!==v.id)];persist();return data[kind];}
function snapshot(draft){save('history',{title:draft.title,draft_id:draft.id,created_at:new Date().toISOString(),draft:structuredClone(draft)});data.history=data.history.slice(0,150);}
function download(name,text){const url=URL.createObjectURL(new Blob([text],{type:'application/octet-stream'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function choose(accept){return new Promise(resolve=>{const f=document.createElement('input');f.type='file';f.accept=accept;f.onchange=()=>resolve(f.files[0]);f.oncancel=()=>resolve(null);f.click();});}
async function call(method,a={}){
  switch(method){
    case 'app.init':return structuredClone(init());
    case 'state.save':{const last=data.history[0];data.workspace=structuredClone(a.workspace);const d=data.workspace.drafts.find(d=>d.id===data.workspace.activeDraft);
      if(!last||Date.now()-Date.parse(last.created_at)>60000)snapshot(d);persist();return {savedAt:new Date().toISOString()};}
    case 'tags.select':data.source=a.source;persist();return {source:data.source,stats:stats()};
    case 'tags.search':{
      const q=normalize(a.query||''),offset=a.offset||0,end=offset+(a.limit||65);
      const rank=t=>a.completion && q ? completionNameRank(normalize(t.name),q) : 0;
      const found=rows().filter(t=>(!a.category||a.category===t.category)&&(!a.filter||({favorites:t.favorite,recent:t.uses,custom:t.custom})[a.filter])&&normalize([t.name,t.translation,...t.aliases].join(' ')).includes(q)).sort((x,y)=>rank(x)-rank(y)||Number(normalize(y.name)===q)-Number(normalize(x.name)===q)||Number(y.favorite)-Number(x.favorite)||y.count-x.count);
      return {items:found.slice(offset,end),total:found.length};
    }
    case 'tags.lookup':return Object.fromEntries(a.names.map(n=>[normalize(n),tag(n)||null]));
    case 'tags.save':{let t=tag(a.name);if(!t){t={uses:0,count:0,favorite:false,aliases:[],category:'自定义'};rows().push(t);}Object.assign(t,{...a,aliases:Array.isArray(a.aliases)?a.aliases:String(a.aliases||'').split(',').map(x=>x.trim()).filter(Boolean),translation_kind:a.translation?(a.translationKind||'zh'):'',translation_source:a.translationSource||'',custom:1});delete t.translationKind;delete t.translationSource;persist();return {tag:t,stats:stats()};}
    case 'tags.favorite':{const t=tag(a.name);t.favorite=!t.favorite;persist();return {tag:t,stats:stats()};}
    case 'tags.use':{const t=tag(a.name);if(t)t.uses++;persist();return;}
    case 'snippets.save':return save('snippets',a);
    case 'presets.save':return save('presets',a);
    case 'presets.delete':data.presets=data.presets.filter(p=>p.id!==a.id);persist();return data.presets;
    case 'history.list':return data.history;
    case 'history.read':return data.history.find(h=>h.id===a.id).draft;
    case 'history.snapshot':snapshot(a.draft);return data.history;
    case 'clipboard.write':try{await navigator.clipboard.writeText(a.text);}catch{const box=document.createElement('textarea');box.value=a.text;document.body.append(box);box.select();const ok=document.execCommand('copy');box.remove();if(!ok)throw Error('请允许浏览器访问剪贴板');}return true;
    case 'export.file':{const b=a.kind==='backup',name='词序-演示-'+a.kind+(b?'.json':'.csv');download(name,b?JSON.stringify({format:'cixu-browser-demo',data}):toCSV(a.kind==='translations'?[['english','translation'],...rows().map(t=>[t.name,t.translation])]:[['name','type','count','aliases','translation'],...rows().map(t=>[t.name,t.type??0,t.count,t.aliases.join(','),t.translation])]));return {filename:name};}
    case 'import.preview':{const b=a.kind==='backup',f=await choose(b?'.json':'.csv');if(!f)return null;
      const text=await f.text(),items=b?[]:importRows(text,a.kind).entries,backup=b?JSON.parse(text):null;
      if(b&&(backup?.format!=='cixu-browser-demo'||!backup.data?.workspace?.drafts?.length||!backup.data.tables?.gelbooru||!backup.data.tables?.danbooru))throw Error('请选择浏览器演示版导出的 JSON 备份');
      const token=uid();pending={token,items,backup};return {kind:a.kind,token,filename:f.name,total:b?backup.data.tables.danbooru.length+backup.data.tables.gelbooru.length:items.length,existing:items.filter(t=>tag(t.name)).length,skipped:0,preview:items.slice(0,10),drafts:backup?.data.workspace.drafts.length||0};}
    case 'import.commit':{if(!pending||pending.token!==a.token)throw Error('请重新预览');const {items,backup}=pending;pending=null;if(backup){data=backup.data;persist();return {restored:init()};}for(const entry of items){const old=tag(entry.name);if(!old)rows().push({aliases:[],uses:0,count:0,favorite:false,category:'自定义',...entry});else if(!old.custom)Object.assign(old,entry);}persist();return {stats:stats()};}
    default:throw Error('此操作需要桌面版');
  }
}
window.cixu={demo:true,call,onClose:()=>()=>{}};
