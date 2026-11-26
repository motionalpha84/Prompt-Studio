import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { seedTags, initialWorkspace, initialSnippets, defaultSettings, maxCompletionLimit } from './seed.mjs';
import { normalize, hydrateDraft, uid, completionNameRank } from './prompt.mjs';
import { importRows } from './csv.mjs';

const parse = (s,fallback) => { try{return JSON.parse(s);}catch{return fallback;} };
const checkText = (s,limit=200000) => typeof s==='string' && s.length<=limit;
export function validateWorkspace(value) {
  if(!value || !Array.isArray(value.drafts) || !value.drafts.length || value.drafts.length>100)throw new Error('草稿数据不完整，最多支持 100 个草稿。');
  const seen=new Set();
  const drafts=value.drafts.map(d=>{
    if(!d || !checkText(d.id,100) || seen.has(d.id) || !checkText(d.title,200)) throw new Error('草稿格式错误。');
    if (d.groups) {
      const ids = new Set();
      if(!Array.isArray(d.groups) || !d.groups.length || d.groups.length>100) throw new Error('提示词组数量无效。');
      for(const g of d.groups){
        if(!g || !checkText(g.id,100) || ids.has(g.id) || !checkText(g.name,200) || !checkText(g.field?.text) || (g.height!=null && (!Number.isFinite(g.height)||g.height<72||g.height>2000))) throw new Error('提示词组格式错误或提示词过长。');
        ids.add(g.id);
      }
    } else if(!checkText(d.positive?.text)||!checkText(d.negative?.text)) throw new Error('旧版草稿格式错误或提示词过长。');
    seen.add(d.id);return hydrateDraft(d);
  });
  const input=value.settings||{};
  const settings={...defaultSettings,...Object.fromEntries(Object.keys(defaultSettings).filter(k=>typeof input[k]===typeof defaultSettings[k]).map(k=>[k,input[k]]))};
  settings.fontSize=Math.max(11,Math.min(22,Number(settings.fontSize)||14));
  settings.tagFontSize=Math.max(10,Math.min(20,Number(settings.tagFontSize)||13));
  settings.completionLimit=Number.isFinite(settings.completionLimit)
    ? Math.max(1,Math.min(maxCompletionLimit,Math.trunc(settings.completionLimit))) : defaultSettings.completionLimit;
  settings.editorPercent=Math.max(32,Math.min(70,Number(settings.editorPercent)||49));
  settings.sidebarWidth=Math.max(260,Math.min(420,Number(settings.sidebarWidth)||272));
  settings.theme=['dark','light','system'].includes(settings.theme)?settings.theme:'system';
  return {schemaVersion:1,drafts,activeDraft:seen.has(value.activeDraft)?value.activeDraft:drafts[0].id,settings};
}

export class Store {
  constructor(root,resources) {
    this.root=root;this.resources=resources;fs.mkdirSync(root,{recursive:true});
    this.db=new DatabaseSync(path.join(root,'cixu.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tags(name TEXT PRIMARY KEY,translation TEXT DEFAULT '',category TEXT DEFAULT '自定义',count INTEGER DEFAULT 0,aliases TEXT DEFAULT '[]',note TEXT DEFAULT '',favorite INTEGER DEFAULT 0,uses INTEGER DEFAULT 0,used_at TEXT DEFAULT '',custom INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS presets(id TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS snippets(id TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS history(id TEXT PRIMARY KEY,title TEXT NOT NULL,draft_id TEXT NOT NULL,value TEXT NOT NULL,created_at TEXT NOT NULL);
    `);
    this.memory=[];this.byName=new Map();this.lastHistory=new Map();
    if(!this.get('workspace')){this.put('workspace',initialWorkspace());for(const s of initialSnippets())this.db.prepare('INSERT INTO snippets VALUES (?,?)').run(s.id,JSON.stringify(s));}
    const tagSchema=this.db.prepare("SELECT sql FROM sqlite_master WHERE name='tags'").get().sql;
    this.db.exec('CREATE TABLE IF NOT EXISTS gel_tags '+tagSchema.slice(tagSchema.indexOf('(')));
    for(const table of ['tags','gel_tags']){
      const columns=this.db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);
      if(!columns.includes('translation_kind'))this.db.exec(`ALTER TABLE ${table} ADD COLUMN translation_kind TEXT NOT NULL DEFAULT ''`);
      if(!columns.includes('translation_source'))this.db.exec(`ALTER TABLE ${table} ADD COLUMN translation_source TEXT NOT NULL DEFAULT ''`);
      this.db.exec(`UPDATE ${table} SET translation_kind='zh' WHERE translation_kind='' AND COALESCE(translation,'')<>''`);
    }
    this.source='danbooru';
    for(const source of ['danbooru','gelbooru']){
      this.source=source;
      const file=resources && path.join(resources,source+'.csv');
      if(!this.get('snapshot-v2-'+source))this.transaction(()=>{
        if(file && fs.existsSync(file)){
          const entries=importRows(fs.readFileSync(file,'utf8')).entries;
          const glossary=new Map(seedTags.map(t=>[t.name,t]));
          for(const entry of entries){
            const hint=glossary.get(entry.name);
            if(hint){entry.translation=hint.translation;entry.category=hint.category;}
          }
          this.upsertBatch(entries);
          this.put('snapshot-v2-'+source,true);
        }else if(!resources && source==='danbooru')this.upsertBatch(seedTags);
        else if(resources)throw new Error('缺少离线词库 '+source+'.csv');
      });
      const glossaryFile=resources && path.join(resources,`zh-${source}.csv`);
      const marker='zh-glossary-v3-'+source;
      if(glossaryFile && fs.existsSync(glossaryFile) && !this.get(marker))this.transaction(()=>{
        this.fillGlossary(source);
        this.put(marker,true);
      });
    }
    this.source=this.get('dictionary')==='gelbooru'?'gelbooru':'danbooru';
    this.refresh();
  }
  get table(){return this.source==='gelbooru'?'gel_tags':'tags';}
  fillGlossary(source){
    const file=this.resources&&path.join(this.resources,`zh-${source}.csv`);if(!file||!fs.existsSync(file))return 0;
    const entries=importRows(fs.readFileSync(file,'utf8'),'glossary').entries,table=source==='gelbooru'?'gel_tags':'tags';
    const fill=this.db.prepare(`UPDATE ${table} SET translation=?,translation_kind=?,translation_source=? WHERE name=? AND COALESCE(translation,'')='' AND custom=0`);
    const attribute=this.db.prepare(`UPDATE ${table} SET translation_kind=?,translation_source=? WHERE name=? AND translation=? AND custom=0 AND translation_kind IN ('','zh','说明','原名/身份标注') AND COALESCE(translation_source,'')=''`);
    const gap=this.db.prepare(`UPDATE ${table} SET translation_kind='缺口',translation_source=? WHERE name=? AND COALESCE(translation,'')='' AND custom=0 AND translation_kind IN ('','zh') AND COALESCE(translation_source,'')=''`);let changed=0;
    for(const e of entries){
      if(e.translationKind==='缺口'){changed+=Number(gap.run(e.source,e.name).changes>0);continue;}
      if(fill.run(e.translation,e.translationKind,e.source,e.name).changes){changed++;continue;}
      changed+=Number(attribute.run(e.translationKind,e.source,e.name,e.translation).changes>0);
    }
    return changed;
  }
  selectSource(source){
    if(!['danbooru','gelbooru'].includes(source))throw new Error('词库名称无效。');
    if(this.source!==source){this.source=source;this.refresh();}
    this.put('dictionary',source);
    return {source,stats:this.stats()};
  }
  get(key){return parse(this.db.prepare('SELECT value FROM kv WHERE key=?').get(key)?.value,null);}
  put(key,value){this.db.prepare('INSERT INTO kv VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key,JSON.stringify(value));}
  transaction(fn){this.db.exec('BEGIN IMMEDIATE');try{const result=fn();this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  refresh(){this.memory=this.db.prepare(`SELECT * FROM ${this.table} ORDER BY count DESC,name`).all().map(t=>({...t,aliases:parse(t.aliases,[]),favorite:!!t.favorite,_key:normalize(t.name),_search:normalize(t.name+' '+t.translation+' '+parse(t.aliases,[]).join(' '))}));this.byName=new Map(this.memory.map(t=>[t._key,t]));}
  publicTag(t){if(!t)return null;const {_key,_search,...tag}=t;return tag;}
  stats(){const notes=this.memory.filter(t=>t.translation&&t.translation_kind==='说明').length,identity=this.memory.filter(t=>t.translation&&t.translation_kind==='原名/身份标注').length,pending=this.memory.filter(t=>!t.translation&&t.translation_kind==='缺口').length;return {total:this.memory.length,translated:this.memory.filter(t=>t.translation&&t.translation_kind==='zh').length,notes,identity,annotated:notes+identity,pending,untranslated:this.memory.filter(t=>!t.translation).length,favorites:this.memory.filter(t=>t.favorite).length,custom:this.memory.filter(t=>t.custom).length,categories:[...new Set(this.memory.map(t=>t.category))].sort((a,b)=>a.localeCompare(b,'zh-CN'))};}
  init(){return {source:this.source,workspace:validateWorkspace(this.get('workspace')),stats:this.stats(),presets:this.presets(),snippets:this.snippets(),dataDir:this.root};}
  saveWorkspace(value){const w=validateWorkspace(value);this.put('workspace',w);for(const d of w.drafts){const prev=this.lastHistory.get(d.id);const signature=JSON.stringify(d.groups);if(prev?.signature!==signature&&(!prev||Date.now()-prev.at>60000)){this.snapshot(d,'自动保存');this.lastHistory.set(d.id,{signature,at:Date.now()});}}return {savedAt:new Date().toISOString()};}
  search({query='',category='',filter='',limit=70,offset=0,completion=false}={}) {
    const q=normalize(String(query).slice(0,200)), words=q.split(' ').filter(Boolean), ranked=[];
    for(const t of this.memory){
      if(category&&t.category!==category||filter==='favorites'&&!t.favorite||filter==='recent'&&!t.uses||filter==='custom'&&!t.custom)continue;
      if(words.length&&!words.every(w=>t._search.includes(w)))continue;
      let score=t.favorite?500:0;score+=Math.min(300,t.uses*12)+Math.log10(t.count+1);
      if(q){if(t._key===q||t.translation===q)score+=100000;else if(t._key.startsWith(q))score+=20000;else if(t.translation.startsWith(q))score+=15000;else if(t.aliases.some(a=>normalize(a)===q))score+=10000;else if(t._key.includes(q))score+=5000;}
      if(filter==='recent')score+=Date.parse(t.used_at||0)/1e10;
      ranked.push({tag:t,score,rank:completion && q ? completionNameRank(t._key,q) : 0});
    }
    ranked.sort((a,b)=>a.rank-b.rank||b.score-a.score||b.tag.count-a.tag.count||a.tag.name.localeCompare(b.tag.name));
    offset=Math.max(0,Number(offset)||0);limit=Math.min(completion ? maxCompletionLimit : 150,Math.max(1,Number(limit)||70));
    return {items:ranked.slice(offset,offset+limit).map(r=>this.publicTag(r.tag)),total:ranked.length};
  }
  lookup(names){if(!Array.isArray(names)||names.length>3000)throw new Error('查询数量过多。');return Object.fromEntries(names.map(n=>[normalize(n),this.publicTag(this.byName.get(normalize(n)))]));}
  use(name){this.db.prepare(`UPDATE ${this.table} SET uses=uses+1,used_at=? WHERE name=?`).run(new Date().toISOString(),name);const t=this.byName.get(normalize(name));if(t){t.uses++;t.used_at=new Date().toISOString();}}
  favorite(name){this.db.prepare(`UPDATE ${this.table} SET favorite=1-favorite WHERE name=?`).run(name);const t=this.byName.get(normalize(name));if(t)t.favorite=!t.favorite;return this.publicTag(t);}
  saveTag(input){
    if(!input||!checkText(input.name,500)||!input.name.trim()||/[\r\n,]/.test(input.name))throw new Error('英文标签不能为空，且不能包含逗号或换行。');
    const name=input.name.trim(),translation=String(input.translation||'').slice(0,1000),category=String(input.category||'自定义').slice(0,80),note=String(input.note||'').slice(0,3000);
    const allowedKinds=['zh','说明','原名/身份标注'];const translationKind=translation?(allowedKinds.includes(input.translationKind)?input.translationKind:'zh'):'';
    const translationSource=String(input.translationSource||'').slice(0,5000);
    const aliases=(Array.isArray(input.aliases)?input.aliases:[]).map(a=>String(a).trim().slice(0,500)).filter(Boolean).slice(0,100);
    this.db.prepare(`INSERT INTO ${this.table}(name,translation,category,aliases,note,custom,translation_kind,translation_source) VALUES (?,?,?,?,?,1,?,?) ON CONFLICT(name) DO UPDATE SET translation=excluded.translation,category=excluded.category,aliases=excluded.aliases,note=excluded.note,custom=1,translation_kind=excluded.translation_kind,translation_source=excluded.translation_source`).run(name,translation,category,JSON.stringify(aliases),note,translationKind,translationSource);
    this.refresh();return this.publicTag(this.byName.get(normalize(name)));
  }
  upsertBatch(entries,preserve=true,kind='tags'){
    const stmt=this.db.prepare(kind==='translations'?`INSERT INTO ${this.table}(name,translation,category,translation_kind,translation_source) VALUES (?,?, '自定义',?,?) ON CONFLICT(name) DO UPDATE SET translation=CASE WHEN ${this.table}.custom=1 AND ?=1 THEN ${this.table}.translation ELSE excluded.translation END,translation_kind=CASE WHEN ${this.table}.custom=1 AND ?=1 THEN ${this.table}.translation_kind ELSE excluded.translation_kind END,translation_source=CASE WHEN ${this.table}.custom=1 AND ?=1 THEN ${this.table}.translation_source ELSE excluded.translation_source END`:
      `INSERT INTO ${this.table}(name,translation,category,count,aliases,note,favorite,translation_kind,translation_source) VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET translation=CASE WHEN ${this.table}.custom=1 AND ?=1 OR excluded.translation='' THEN ${this.table}.translation ELSE excluded.translation END,translation_kind=CASE WHEN ${this.table}.custom=1 AND ?=1 OR excluded.translation='' THEN ${this.table}.translation_kind ELSE excluded.translation_kind END,translation_source=CASE WHEN ${this.table}.custom=1 AND ?=1 OR excluded.translation='' THEN ${this.table}.translation_source ELSE excluded.translation_source END,category=CASE WHEN ${this.table}.custom=1 AND ?=1 THEN ${this.table}.category ELSE excluded.category END,count=MAX(${this.table}.count,excluded.count),aliases=CASE WHEN ${this.table}.custom=1 AND ?=1 THEN ${this.table}.aliases ELSE excluded.aliases END`);
    for(const e of entries){if(kind==='translations')stmt.run(e.name,e.translation,e.translationKind||'zh',e.source||'',Number(preserve),Number(preserve),Number(preserve));else {const translation=e.translation||'',translationKind=e.translationKind||e.translation_kind||(translation?'zh':''),translationSource=e.source||e.translation_source||'';stmt.run(e.name,translation,e.category||'自定义',Math.min(1e12,Number(e.count)||0),JSON.stringify(e.aliases||[]),e.note||'',Number(!!e.favorite),translationKind,translationSource,Number(preserve),Number(preserve),Number(preserve),Number(preserve),Number(preserve));}}
  }
  import(entries,kind){this.transaction(()=>this.upsertBatch(entries,true,kind));this.refresh();return this.stats();}
  presets(){return this.db.prepare('SELECT value FROM presets ORDER BY updated_at DESC').all().map(r=>parse(r.value,null)).filter(Boolean);}
  snippets(){return this.db.prepare('SELECT value FROM snippets').all().map(r=>parse(r.value,null)).filter(Boolean);}
  savePreset(value){
    if(!checkText(value.name,200)||!value.name.trim()||!value.draft)throw new Error('请填写方案名称。');
    const draft=validateWorkspace({drafts:[value.draft],settings:{}}).drafts[0];
    const cover=typeof value.cover==='string'&&/^data:image\/(png|jpeg|webp);base64,/.test(value.cover)&&value.cover.length<5e6?value.cover:'';
    const p={id:value.id||uid(),name:value.name.trim(),category:String(value.category||'未分类').slice(0,100),note:String(value.note||'').slice(0,3000),cover,draft,updatedAt:new Date().toISOString()};
    this.db.prepare('INSERT OR REPLACE INTO presets VALUES (?,?,?)').run(p.id,JSON.stringify(p),p.updatedAt);this.snapshot(draft,'保存方案');return this.presets();
  }
  deletePreset(id){this.db.prepare('DELETE FROM presets WHERE id=?').run(id);return this.presets();}
  saveSnippet(s){if(!checkText(s.name,200)||!s.name.trim()||!checkText(s.text,20000)||!s.text.trim())throw new Error('请填写片段名称和内容。');const v={id:s.id||uid(),name:s.name.trim(),text:s.text,category:String(s.category||'常用').slice(0,80)};this.db.prepare('INSERT OR REPLACE INTO snippets VALUES (?,?)').run(v.id,JSON.stringify(v));return this.snippets();}
  deleteSnippet(id){this.db.prepare('DELETE FROM snippets WHERE id=?').run(id);return this.snippets();}
  snapshot(draft,label='手动快照'){const id=uid();this.db.prepare('INSERT INTO history VALUES (?,?,?,?,?)').run(id,`${draft.title} · ${label}`,draft.id,JSON.stringify(draft),new Date().toISOString());this.db.exec('DELETE FROM history WHERE id NOT IN (SELECT id FROM history ORDER BY created_at DESC LIMIT 150)');return id;}
  history(){return this.db.prepare('SELECT id,title,draft_id,created_at FROM history ORDER BY created_at DESC LIMIT 150').all();}
  historyDraft(id){const row=this.db.prepare('SELECT value FROM history WHERE id=?').get(id);if(!row)throw new Error('历史记录不存在。');return hydrateDraft(JSON.parse(row.value));}
  backup(){const rows=table=>this.db.prepare('SELECT * FROM '+table).all().map(t=>({...t,aliases:parse(t.aliases,[]),favorite:!!t.favorite}));return {format:'cixu-prompt-studio',schemaVersion:2,source:this.source,exportedAt:new Date().toISOString(),workspace:this.get('workspace'),tags:rows('tags'),gelbooruTags:rows('gel_tags'),presets:this.presets(),snippets:this.snippets(),history:this.db.prepare('SELECT * FROM history ORDER BY created_at DESC').all()};}
  validateBackup(input){
    if(input?.format!=='cixu-prompt-studio'||![1,2].includes(input.schemaVersion)||!Array.isArray(input.tags)||input.tags.length>500000||!Array.isArray(input.presets)||input.presets.length>1000||!Array.isArray(input.snippets)||input.snippets.length>1000)throw new Error('不是受支持的词序备份文件。');
    const workspace=validateWorkspace(input.workspace);
    if(input.schemaVersion===2 && (!Array.isArray(input.gelbooruTags)||input.gelbooruTags.length>500000))throw new Error('Gelbooru 备份格式错误。');
    for(const t of [...input.tags,...(input.gelbooruTags||[])]){if(!checkText(t.name,500)||!t.name.trim()||!checkText(t.translation??'',1000)||!checkText(t.category??'',80)||!checkText(t.note??'',3000)||!checkText(t.translation_source??'',5000)||!Array.isArray(t.aliases)||t.aliases.length>100||!t.aliases.every(a=>checkText(a,500)))throw new Error('备份词库格式错误。');}
    for(const p of input.presets){if(!checkText(p.id,100)||!checkText(p.name,200))throw new Error('备份方案格式错误。');validateWorkspace({drafts:[p.draft]});if(p.cover&&(!/^data:image\/(png|jpeg|webp);base64,/.test(p.cover)||p.cover.length>5e6))throw new Error('方案封面格式错误。');}
    for(const s of input.snippets)if(!checkText(s.id,100)||!checkText(s.name,200)||!checkText(s.text,20000))throw new Error('备份片段格式错误。');
    const history=input.history||[];if(!Array.isArray(history)||history.length>150)throw new Error('备份历史格式错误。');for(const h of history){if(!checkText(h.id,100)||!checkText(h.title,500)||!checkText(h.draft_id,100)||!checkText(h.created_at,100)||!checkText(h.value,2e6))throw new Error('备份历史格式错误。');validateWorkspace({drafts:[JSON.parse(h.value)]});}
    return {...input,workspace,history};
  }
  restore(input){const b=this.validateBackup(input);this.writeAutoBackup('恢复前');this.transaction(()=>{this.db.exec('DELETE FROM presets; DELETE FROM snippets; DELETE FROM history;');
    const originalSource=this.source;
    try {
      for(const [source,entries] of [['danbooru',b.tags],['gelbooru',b.gelbooruTags]]){
        if(!entries)continue;
        this.source=source;
        this.db.exec('DELETE FROM '+this.table);
        this.upsertBatch(entries,false);
        const extra=this.db.prepare('UPDATE '+this.table+' SET favorite=?,uses=?,used_at=?,custom=? WHERE name=?');
        for(const t of entries)extra.run(Number(!!t.favorite),Math.max(0,Number(t.uses)||0),String(t.used_at||''),Number(!!t.custom),t.name);
      }
    } finally {this.source=originalSource;}
    for(const source of ['danbooru','gelbooru'])this.fillGlossary(source);
    this.put('dictionary',b.source==='gelbooru'?'gelbooru':'danbooru');
    for(const p of b.presets)this.db.prepare('INSERT INTO presets VALUES (?,?,?)').run(p.id,JSON.stringify(p),p.updatedAt||'');for(const s of b.snippets)this.db.prepare('INSERT INTO snippets VALUES (?,?)').run(s.id,JSON.stringify(s));for(const h of b.history)this.db.prepare('INSERT INTO history VALUES (?,?,?,?,?)').run(h.id,h.title,h.draft_id,h.value,h.created_at);this.put('workspace',b.workspace);});this.source=this.get('dictionary');this.refresh();return this.init();}
  writeAutoBackup(label='自动'){
    const dir=path.join(this.root,'backups');fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,`${new Date().toISOString().replace(/[:.]/g,'-')}-${label}.json`);
    fs.writeFileSync(file+'.tmp',JSON.stringify(this.backup()));fs.renameSync(file+'.tmp',file);
    const files=fs.readdirSync(dir).filter(f=>f.endsWith('.json')).sort().reverse();for(const old of files.slice(10))fs.unlinkSync(path.join(dir,old));return file;
  }
  close(){this.db.close();}
}
