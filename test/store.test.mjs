import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {Store,validateWorkspace} from '../core/store.mjs';
import {newDraft,parseField,toggleTag} from '../core/prompt.mjs';
const create=()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'cixu-test-'));const store=new Store(root);return {store,root,close:()=>{store.close();fs.rmSync(root,{recursive:true,force:true});}};};

test('旧设置补上默认候选数，导入的数量限制在有效整数范围',()=>{
  const drafts=[newDraft()];
  for(const [input,expected] of [[undefined,200],[null,200],[NaN,200],[0,1],[17.8,17],[5000,1000]]){
    assert.equal(validateWorkspace({drafts,settings:{completionLimit:input}}).settings.completionLimit,expected);
  }
});

test('补全先排完所有前缀，再排中间和词内片段，最后按上限截取',()=>{
  const c=create();
  try {
    const s=c.store;
    s.selectSource('gelbooru');
    s.import([
      ...Array.from({length:18},(_,i)=>({name:'high_'+i,count:1000+i})),
      {name:'high'}, {name:'kita_high_school_uniform',aliases:['HIGH'],favorite:true,count:90000}, {name:'thighhighs'},
      {name:'alias_only',aliases:['high'],count:999999}
    ],'tags');
    const names=(query,offset=0,limit=8)=>s.search({query,offset,limit,completion:true}).items.map(t=>t.name);
    const first=names('HIGH');
    assert.equal(first[0],'high');
    assert.ok(first.every(name=>name.startsWith('high')));
    assert.deepEqual(names('high',19,3),['kita_high_school_uniform','thighhighs','alias_only']);
    assert.deepEqual([...first,...names('high',8)],names('high',0,16));
    assert.equal(new Set(names('high',0,60)).size,22);
    assert.deepEqual(names('higH sch'),names('HIGH_sch'));
    assert.deepEqual(names('higH sch'),['kita_high_school_uniform']);
    assert.deepEqual(names('ghhi'),['thighhighs']);
  } finally {c.close();}
});

test('中文、英文、别名均可查找，精确匹配排在最前',()=>{const c=create();try{const s=c.store;assert.equal(s.search({query:'长发'}).items[0].name,'long_hair');assert.equal(s.search({query:'long h'}).items[0].name,'long_hair');s.saveTag({name:'test_hair',translation:'测试发型',aliases:['发型测试'],category:'头发'});assert.equal(s.search({query:'发型测试'}).items[0].name,'test_hair');}finally{c.close();}});
test('保存重启后恢复多草稿、原始分行、分组名称和禁用状态',()=>{const c=create();try{const w=c.store.init().workspace;const d=newDraft('持久化测试','a, b,\n\nc,');d.groups[0].field.lines[0].label='组一';d.groups[0].field=toggleTag(d.groups[0].field,d.groups[0].field.lines[0].id,d.groups[0].field.lines[0].items[0].id);w.drafts.push(d);w.activeDraft=d.id;c.store.saveWorkspace(w);c.store.close();c.store=new Store(c.root);const n=c.store.init().workspace;assert.equal(n.activeDraft,d.id);assert.equal(n.drafts.at(-1).groups[0].field.text,'b,\n\nc,');assert.equal(n.drafts.at(-1).groups[0].field.lines[0].label,'组一');assert.equal(n.drafts.at(-1).groups[0].field.lines[0].items[0].disabled,true);}finally{c.store.close();fs.rmSync(c.root,{recursive:true,force:true});}});
test('基础词库更新保留个人翻译、备注、别名、分类和收藏',()=>{const c=create();try{const s=c.store;s.saveTag({name:'long_hair',translation:'我的长发',category:'我的头发',aliases:['我常用的发型'],note:'保留备注'});s.favorite('long_hair');const before=s.lookup(['long hair'])['long hair'];s.import([{name:'long_hair',translation:'覆盖翻译',category:'通用',aliases:[],count:999999}],'tags');s.import([{name:'long_hair',translation:'再次覆盖'}],'translations');const after=s.lookup(['long hair'])['long hair'];assert.equal(after.translation,before.translation);assert.equal(after.note,before.note);assert.equal(after.category,before.category);assert.deepEqual(after.aliases,before.aliases);assert.equal(after.favorite,before.favorite);}finally{c.close();}});
test('完整备份可恢复词库、方案、片段、草稿、释义来源和个人状态',()=>{const c=create();try{const s=c.store;const w=s.init().workspace;w.drafts[0].groups[0].field=parseField('自定义原文,\n\n保留空行,');s.saveWorkspace(w);s.savePreset({name:'备份方案',category:'测试',draft:w.drafts[0]});s.saveSnippet({name:'备份片段',text:'a, b,'});s.saveTag({name:'backup_test',translation:'备份词',translationSource:'个人来源记录',aliases:['别名'],category:'我的',note:'备注'});s.favorite('backup_test');s.use('backup_test');const b=s.backup();s.saveTag({name:'backup_test',translation:'被修改'});const restored=s.restore(b);assert.equal(s.lookup(['backup_test'])['backup test'].translation,'备份词');assert.equal(s.lookup(['backup_test'])['backup test'].translation_source,'个人来源记录');assert.equal(s.lookup(['backup_test'])['backup test'].favorite,true);assert.equal(restored.presets[0].name,'备份方案');assert.equal(restored.workspace.drafts[0].groups[0].field.text,'自定义原文,\n\n保留空行,');assert.ok(restored.snippets.some(s=>s.name==='备份片段'));assert.ok(fs.readdirSync(path.join(c.root,'backups')).length);}finally{c.close();}});
test('无效备份拒绝恢复，现有数据保持完整',()=>{const c=create();try{const before=c.store.stats().total;const b=c.store.backup();b.tags.push({name:'invalid',aliases:'wrong'});assert.throws(()=>c.store.restore(b),/格式错误/);assert.equal(c.store.stats().total,before);}finally{c.close();}});
test('历史恢复不丢失组名或禁用状态，最多保留150条',()=>{const c=create();try{const d=newDraft('快照','a, b,');d.groups[0].field.lines[0].label='部位';const id=c.store.snapshot(d);assert.equal(c.store.historyDraft(id).groups[0].field.lines[0].label,'部位');for(let i=0;i<160;i++)c.store.snapshot(d);assert.equal(c.store.history().length,150);}finally{c.close();}});
test('草稿数据长度、ID唯一性、设置类型在存储边界校验',()=>{const d=newDraft();assert.throws(()=>validateWorkspace({drafts:[d,d]}),/格式错误/);assert.throws(()=>validateWorkspace({drafts:[{...d,groups:[{...d.groups[0],field:{text:'x'.repeat(200001)}}]}]}),/过长/);const w=validateWorkspace({drafts:[d],settings:{fontSize:999,editorPercent:0,tagFontSize:99,sidebarWidth:200,theme:'arbitrary'}});assert.equal(w.settings.fontSize,22);assert.equal(w.settings.tagFontSize,20);assert.equal(w.settings.sidebarWidth,260);assert.equal(w.settings.theme,'system');});
test('72/84px 提示词组高度可保存、重启并可恢复为旧稿',()=>{const c=create();try{let w=c.store.init().workspace;for(const height of [72,84]){w.drafts[0].groups[0].height=height;assert.doesNotThrow(()=>c.store.saveWorkspace(w));c.store.close();c.store=new Store(c.root);w=c.store.init().workspace;assert.equal(w.drafts[0].groups[0].height,height);}}finally{c.store.close();fs.rmSync(c.root,{recursive:true,force:true});}});
test('旧版双栏、方案及备份迁移为普通组',()=>{
  const c=create();try{
    const f=parseField('a, b,\n\nc');const positive=structuredClone(f);delete positive.visibleTextVersion;positive.lines[0].items[1].disabled=true;
    const legacy={id:'legacy',title:'旧稿',positive,negative:parseField('low quality')};
    const draft=validateWorkspace({drafts:[legacy]}).drafts[0];assert.equal(draft.groups.length,2);
    assert.equal(draft.groups[0].field.text,'a,\n\nc');assert.ok(draft.groups[0].field.lines[0].items[1].disabled);
    assert.equal(draft.groups[1].field.text,'low quality');
    const b=c.store.backup();b.schemaVersion=1;delete b.gelbooruTags;b.workspace={drafts:[legacy]};assert.equal(c.store.restore(b).workspace.drafts[0].groups.length,2);
  }finally{c.close();}
});
test('两个词库隔离搜索、翻译、收藏、使用计数和备份恢复',()=>{
  const c=create();try{
    const s=c.store;s.saveTag({name:'shared',translation:'丹'});s.favorite('shared');s.use('shared');
    s.selectSource('gelbooru');s.saveTag({name:'shared',translation:'凝'});s.import([{name:'gel_only',count:21}],'tags');
    assert.equal(s.lookup(['shared']).shared.favorite,false);assert.equal(s.lookup(['shared']).shared.uses,0);
    const b=s.backup();s.selectSource('danbooru');assert.equal(s.lookup(['gel_only'])['gel only'],null);assert.ok(s.lookup(['shared']).shared.favorite);
    assert.equal(s.restore(b).source,'gelbooru');assert.equal(s.lookup(['shared']).shared.translation,'凝');
  }finally{c.close();}
});

test('中英 glossaries 按站点补空释义，区分注记，保留用户字段与旧备份数据并可重启',()=>{
  const c=create();try{
    const s=c.store;
    s.db.prepare("INSERT INTO tags(name,translation,category,aliases,note,custom) VALUES (?,?,?,?,?,0)").run('keep_me','我的释义','我的分类','["mine"]','个人备注');s.favorite('keep_me');s.use('keep_me');
    s.db.prepare("INSERT INTO tags(name,translation,category,custom) VALUES (?,?,?,0)").run('glossary_note','','个人分类');
    s.selectSource('gelbooru');s.db.prepare("INSERT INTO gel_tags(name,translation,category,custom) VALUES (?,?,?,0)").run('gel_empty','','Gel个人分类');s.refresh();
    for(const source of ['danbooru','gelbooru'])s.put('snapshot-v2-'+source,true);s.selectSource('danbooru');
    assert.ok(s.lookup(['keep_me'])['keep me']);
    s.db.prepare("INSERT INTO tags(name,translation,category,custom) VALUES (?,?,?,0)").run('identity','','身份标注');s.db.prepare("INSERT INTO tags(name,translation,category,custom) VALUES (?,?,?,0)").run('missing','','待考证');s.refresh();
    s.close();
    const resource=fs.mkdtempSync(path.join(os.tmpdir(),'cixu-glossary-'));
    fs.writeFileSync(path.join(resource,'zh-danbooru.csv'),'name,translation,kind,source\nkeep_me,包内覆盖,zh,test\nglossary_note,某类标签的说明,说明,test\nidentity,可查证的角色名,原名/身份标注,test\nmissing,,缺口,已检索官方索引，仍未找到可信释义。\n');
    fs.writeFileSync(path.join(resource,'zh-gelbooru.csv'),'name,translation,kind,source\ngel_empty,凝,zh,test\n');
    const migrated=new Store(c.root,resource);c.store=migrated;
    migrated.selectSource('danbooru');assert.equal(migrated.lookup(['keep_me'])['keep me'].translation,'我的释义');
    assert.equal(migrated.lookup(['keep_me'])['keep me'].category,'我的分类');
    assert.deepEqual(migrated.lookup(['keep_me'])['keep me'].aliases,['mine']);assert.equal(migrated.lookup(['keep_me'])['keep me'].note,'个人备注');
    assert.equal(migrated.lookup(['glossary_note'])['glossary note'].translation_kind,'说明');assert.ok(migrated.stats().translated>1);assert.equal(migrated.stats().notes,1);assert.equal(migrated.stats().identity,1);assert.equal(migrated.stats().annotated,2);
    assert.equal(migrated.lookup(['missing']).missing.translation,'');assert.equal(migrated.lookup(['missing']).missing.translation_kind,'缺口');assert.match(migrated.lookup(['missing']).missing.translation_source,/已检索官方索引/);assert.equal(migrated.stats().pending,1);assert.ok(migrated.stats().untranslated>=1);
    migrated.selectSource('gelbooru');assert.equal(migrated.lookup(['gel_empty'])['gel empty'].translation,'凝');assert.equal(migrated.stats().translated,1);
    const backup=migrated.backup();backup.schemaVersion=1;delete backup.gelbooruTags;
    migrated.selectSource('danbooru');migrated.restore(backup);migrated.selectSource('danbooru');
    assert.equal(migrated.lookup(['keep_me'])['keep me'].translation,'我的释义');assert.equal(migrated.lookup(['missing']).missing.translation_source,'已检索官方索引，仍未找到可信释义。');
    migrated.close();c.store=new Store(c.root,resource);
    c.store.selectSource('danbooru');assert.equal(c.store.lookup(['glossary_note'])['glossary note'].translation_kind,'说明');
    assert.equal(c.store.lookup(['keep_me'])['keep me'].uses,1);
    fs.rmSync(resource,{recursive:true,force:true});
  }finally{c.store.close();fs.rmSync(c.root,{recursive:true,force:true});}
});

test('0.3.0 数据的 v2 词库迁移只补空白、保留手动与刻意留空，并持久化流萤设置',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'cixu-firefly-migrate-'));
  const resources=fs.mkdtempSync(path.join(os.tmpdir(),'cixu-firefly-glossary-'));
  let store;
  try{
    store=new Store(root);
    for(const source of ['danbooru','gelbooru']){
      store.put('snapshot-v2-'+source,true);
      store.put('zh-glossary-v1-'+source,true);
    }
    store.db.prepare('INSERT INTO tags(name,translation,category,note,favorite,custom) VALUES (?,?,?,?,?,0)').run('new_firefly_tag','','旧分类','保留注释',1);
    store.db.prepare('INSERT INTO tags(name,translation,category,custom) VALUES (?,?,?,0)').run('old_named_tag','原有个人译名','个人分类');
    store.db.prepare('INSERT INTO tags(name,translation,category,note,custom) VALUES (?,?,?,?,1)').run('intentional_blank','','个人分类','刻意留空');
    store.db.prepare('INSERT INTO gel_tags(name,translation,category,custom) VALUES (?,?,?,0)').run('new_firefly_tag_gel','','Gel分类');
    const legacy=store.init().workspace;legacy.settings.theme='dark';delete legacy.settings.tagFontSize;delete legacy.settings.fireflies;store.saveWorkspace(legacy);
    store.close();store=null;
    fs.writeFileSync(path.join(resources,'zh-danbooru.csv'),'name,translation,kind,source\nnew_firefly_tag,萤火标签,zh,测试来源\nold_named_tag,要覆盖的译名,zh,测试来源\nintentional_blank,不应填入,zh,测试来源\n');
    fs.writeFileSync(path.join(resources,'zh-gelbooru.csv'),'name,translation,kind,source\nnew_firefly_tag_gel,凝光标签,zh,Gel来源\n');
    store=new Store(root,resources);
    assert.equal(store.get('zh-glossary-v1-danbooru'),true);assert.equal(store.get('zh-glossary-v3-danbooru'),true);
    assert.equal(store.lookup(['new_firefly_tag'])['new firefly tag'].translation,'萤火标签');
    assert.equal(store.lookup(['new_firefly_tag'])['new firefly tag'].translation_source,'测试来源');
    assert.equal(store.lookup(['new_firefly_tag'])['new firefly tag'].note,'保留注释');assert.equal(store.lookup(['new_firefly_tag'])['new firefly tag'].favorite,true);
    assert.equal(store.lookup(['old_named_tag'])['old named tag'].translation,'原有个人译名');
    assert.equal(store.lookup(['intentional_blank'])['intentional blank'].translation,'');assert.equal(store.lookup(['intentional_blank'])['intentional blank'].note,'刻意留空');
    assert.equal(store.init().workspace.settings.tagFontSize,13);assert.equal(store.init().workspace.settings.fireflies,true);
    const workspace=store.init().workspace;workspace.settings={...workspace.settings,theme:'system',tagFontSize:19,fireflies:false,sidebarWidth:386};store.saveWorkspace(workspace);
    store.close();store=new Store(root,resources);const saved=store.init().workspace.settings;
    assert.equal(saved.theme,'system');assert.equal(saved.tagFontSize,19);assert.equal(saved.fireflies,false);assert.equal(saved.sidebarWidth,386);
    assert.equal(store.lookup(['new_firefly_tag'])['new firefly tag'].translation,'萤火标签');
    store.selectSource('gelbooru');assert.equal(store.lookup(['new_firefly_tag_gel'])['new firefly tag gel'].translation,'凝光标签');
  }finally{try{store?.close();}catch{}fs.rmSync(root,{recursive:true,force:true});fs.rmSync(resources,{recursive:true,force:true});}
});
