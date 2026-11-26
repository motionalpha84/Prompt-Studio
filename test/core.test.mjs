import test from 'node:test';
import assert from 'node:assert/strict';
import {parseField,splitLine,editLine,toggleTag,moveTag,moveAcrossGroups,setWeight,insertText,completionAt,acceptCompletion,formatTagInput,outputField,withTrailingTagComma,duplicateCount,normalize,editGroups,hydrateDraft,newDraft} from '../core/prompt.mjs';
import {parseCSV,importRows,toCSV} from '../core/csv.mjs';

test('剪贴板只补最后一个标签的分隔逗号，保留空行、权重和转义逗号',()=>{
  for(const [input,expected] of [
    ['looking at viewer, closed mouth, smile','looking at viewer, closed mouth, smile,'],
    ['a\n(b, c:1.2)  \n\n','a\n(b, c:1.2),  \n\n'],
    ['a, \n\n','a, \n\n'],['name\\,','name\\,,'],['"a,b"','"a,b",'],[' \n\t',''],
  ]){
    const output=withTrailingTagComma(input);
    assert.equal(output,expected);
    assert.equal(withTrailingTagComma(output),expected);
  }
  const field=parseField('solo,\nname\\,');
  for(const keepTagSpaces of [true,false]){
    const result=withTrailingTagComma(outputField(field,{singleLine:true,keepTagSpaces}));
    assert.equal(result,keepTagSpaces?'solo, name\\,,':'solo,name\\,,');
  }
});

test('分行、连续空行、尾部空行与原始空格往返保留',()=>{const raw='1girl, solo,\n\n long hair, black hair, \n\n';assert.equal(outputField(parseField(raw)),raw);assert.equal(parseField(raw).lines.length,5);});
test('复制选项只移除顶层分隔逗号两侧的空白，并与换行、下划线设置独立',()=>{
  const raw='  long hair,  blue_eyes ,\t(red, blue:1.2), "a, b", a\\, b,\n\n  white shirt,';
  const field=parseField(raw);
  assert.equal(outputField(field,{keepTagSpaces:true}),raw);
  assert.equal(outputField(field,{keepTagSpaces:false}),'  long hair,blue_eyes,(red, blue:1.2),"a, b",a\\, b,\n\n  white shirt,');
  assert.equal(outputField(field,{keepTagSpaces:false,singleLine:true,outputSpaces:true}),'long hair,blue eyes,(red, blue:1.2),"a, b",a\\, b,white shirt');
  assert.equal(field.text,raw);
});
test('权重分组、转义括号、引号里的逗号不被拆开',()=>{const line='(blue eyes, smile:1.2), asta \\(honkai: star rail\\), "soft, warm", [red:blue:0.5], <custom:a,b>';assert.equal(splitLine(line).length,5);assert.equal(splitLine(line)[0].weight,1.2);});
test('自然语言与未知语法原样保留',()=>{const raw='A quiet room with a window\n__outfit__, [red:blue:0.5],';assert.equal(outputField(parseField(raw)),raw);});
test('删除标签只修改所在行，保留其他行和空行',()=>{const f=parseField('long hair, black hair,\n\nblue eyes, smile,');const n=editLine(f,f.lines[0].id,items=>items.splice(1,1));assert.equal(n.text,'long hair,\n\nblue eyes, smile,');});
test('隐藏后编辑与复制一致，恢复原始行与位置',()=>{const f=parseField('long hair, black hair,\n\nblue eyes,');const n=toggleTag(f,f.lines[0].id,f.lines[0].items[0].id);assert.equal(n.text,'black hair,\n\nblue eyes,');assert.equal(outputField(n),'black hair,\n\nblue eyes,');assert.equal(outputField(toggleTag(n,n.lines[0].id,n.lines[0].items[0].id)),f.text);});
test('手动输入同名词只创建启用项，隐藏 ID 可独立恢复',()=>{let f=parseField('long hair, blue eyes,');const id=f.lines[0].items[0].id;f=toggleTag(f,f.lines[0].id,id);const n=parseField('(long hair:1.2), blue eyes,',f);const items=n.lines[0].items;assert.ok(items.find(t=>t.id===id).disabled);assert.equal(items.filter(t=>!t.disabled).length,2);assert.equal(new Set(items.map(t=>t.id)).size,3);});
test('在头部插入空行，原有分组名称跟随内容',()=>{const f=parseField('long hair,\nblue eyes,');f.lines[0].label='头发';const n=parseField('\n'+f.text,f);assert.equal(n.lines[1].label,'头发');assert.equal(n.lines[1].id,f.lines[0].id);});
test('跨行拖动保留禁用状态，空行可接收标签',()=>{let f=parseField('long hair, black hair,\n\nblue eyes,');f=toggleTag(f,f.lines[0].id,f.lines[0].items[0].id);const id=f.lines[0].items[0].id;const n=moveTag(f,f.lines[0].id,id,f.lines[1].id);assert.equal(n.text,'black hair,\n\nblue eyes,');assert.equal(n.lines[1].items[0].id,id);assert.equal(n.lines[1].items[0].disabled,true);});
test('同一行拖动到指定词条前',()=>{const f=parseField('a, b, c,');const n=moveTag(f,f.lines[0].id,f.lines[0].items[2].id,f.lines[0].id,f.lines[0].items[0].id);assert.equal(n.text,'c, a, b,');});
test('跨组批量拖动按原文顺序插入单个落点，保留同名、权重、隐藏项和空行',()=>{
  const groups=[...newDraft('源','x, (a:1.4),\nh, x,\nkeep').groups,...newDraft('目标','left, right,\n').groups];
  const [first,second]=groups[0].field.lines;
  const [x,a]=first.items,[h,otherX]=second.items;
  const source=editGroups(groups,[h.id],'hide');
  const target=source[1].field.lines[0];
  const moved=moveAcrossGroups(source,[otherX.id,h.id,a.id,x.id],target.id,target.items[1].id);
  assert.equal(moved[0].field.text,'\n\nkeep');
  assert.equal(moved[1].field.text,'left, x, (a:1.4), x, right,\n');
  const items=moved[1].field.lines[0].items;
  assert.deepEqual(items.slice(1,5).map(t=>t.id),[x.id,a.id,h.id,otherX.id]);
  assert.ok(items[3].disabled);
  assert.equal(source[1].field.text,'left, right,\n');
});
test('同一行批量拖动以移除前的落点定位，原位释放不改动草稿',()=>{
  const groups=newDraft('测试','a, b, c, d, e,\n').groups;
  const [line,empty]=groups[0].field.lines;
  const [a,b,c,d,e]=line.items.map(t=>t.id);
  assert.equal(moveAcrossGroups(groups,[b,c],line.id,c),groups);
  assert.equal(moveAcrossGroups(groups,[b,c],line.id,d),groups);
  assert.equal(moveAcrossGroups(groups,[c,e],line.id,a)[0].field.text,'c, e, a, b, d,\n');
  assert.equal(moveAcrossGroups(groups,[b,d],line.id,d)[0].field.text,'a, c, b, d, e,\n');
  assert.equal(moveAcrossGroups(groups,[a,b],line.id)[0].field.text,'c, d, e, a, b,\n');
  assert.equal(moveAcrossGroups(groups,[a,b],empty.id)[0].field.text,'c, d, e,\na, b');
});
test('调整权重没有浮点累积误差，回到1时去掉包裹',()=>{assert.equal(setWeight('long hair',.1),'(long hair:1.1)');assert.equal(setWeight('(long hair:1.1)',-.1),'long hair');assert.equal(setWeight('(long hair:2.95)',.1),'(long hair:3)');});
test('补全仅替换当前词，保留其他行并转义角色名括号',()=>{const f=parseField('long hair,\n阿斯塔\nblue eyes,');const context=completionAt(f,14);const n=acceptCompletion(f,context,'asta_(honkai:_star_rail)',true);assert.equal(n.field.text,'long hair,\nasta \\(honkai: star rail\\),\nblue eyes,');});
test('补全复用分隔符，光标越过逗号和空格，关闭后仅插入逗号',()=>{
  for(const [original,caret,enabled,expected] of [
    ['lo',2,true,'long hair, |'],['lo',2,false,'long hair,|'],
    ['lo  ',4,true,'long hair,  |'],['lo ,  solo',2,true,'long hair,  |solo'],
    ['a,lo,b',4,true,'a, long hair, |b'],['lo,solo',2,false,'long hair,|solo'],
    ['lo, solo',2,false,'long hair, |solo'],['lo\nsolo',2,true,'long hair,|\nsolo'],
  ]){
    const field=parseField(original),result=acceptCompletion(field,completionAt(field,caret),'long_hair',true,true,enabled);
    assert.equal(result.field.text.slice(0,result.caret)+'|'+result.field.text.slice(result.caret),expected,original);
  }
});
test('新输入和粘贴仅为顶层逗号加空格，不重排其他文字',()=>{
  const raw='old,old\n(x,y:1.2),"a,b",a\\,b，next,';
  const format=autoTagSpace=>formatTagInput(raw,8,raw.length,{autoTagSpace,convertComma:true});
  assert.equal(format(true).text,'old,old\n(x,y:1.2), "a,b", a\\,b, next,');
  assert.equal(format(false).text,raw.replace('，',','));
  assert.deepEqual(formatTagInput('lo，end',2,3,{convertComma:true}),{text:'lo, end',caret:4});
  assert.deepEqual(formatTagInput('a,',1,2,{}),{text:'a, ',caret:3});
  assert.deepEqual(formatTagInput('a,b',2,2,{}),{text:'a,b',caret:2});
});
test('词库插入、标签视图重排共用输入分隔空格设置',()=>{
  const field=parseField('left,right');
  assert.equal(insertText(field,5,'mid',true).field.text,'left, mid, right');
  assert.equal(insertText(field,5,'mid',false).field.text,'left,mid,right');
  const groups=newDraft('测试','x,y,z').groups,line=groups[0].field.lines[0];
  assert.equal(moveAcrossGroups(groups,line.items[2].id,line.id,line.items[0].id,false)[0].field.text,'z,x,y');
});
test('带权重标签接受补全时保留权重',()=>{const f=parseField('(长发:1.2), blue eyes');const n=acceptCompletion(f,completionAt(f,3),'long_hair',true);assert.equal(n.field.text,'(long hair:1.2), blue eyes');});
test('从词库插入到行中间不会合并相邻标签',()=>{const f=parseField('long hair\nblue eyes');const n=insertText(f,9,'black hair');assert.equal(n.field.text,'long hair, black hair\nblue eyes');});
test('带尾逗号的常用片段插入行首不生成重复逗号',()=>{const f=parseField('long hair,\nblue eyes,');const n=insertText(f,0,'soft lighting, warm lighting,');assert.equal(n.field.text,'soft lighting, warm lighting, long hair,\nblue eyes,');});
test('单行输出去掉换行，不产生双逗号，并跳过禁用词',()=>{let f=parseField('a, b,\n\nc,');f=toggleTag(f,f.lines[0].id,f.lines[0].items[1].id);assert.equal(outputField(f,{singleLine:true}),'a, c');});
test('重复计数统一空格、下划线、转义与权重',()=>{const f=parseField('long_hair, (long hair:1.2),\nlong hair,');assert.equal(duplicateCount(f).get('long hair'),3);assert.equal(normalize('asta \\(honkai\\)'),'asta (honkai)');});
test('CSV 支持 BOM、逗号、双引号、CRLF、带换行的单元格',()=>{const values=[['name','translation'],['hello,world','他说"你好"'],['new','两\n行']];assert.deepEqual(parseCSV(toCSV(values)),values);assert.throws(()=>parseCSV('a,"broken'),/未闭合/);});
test('Tag Autocomplete 四列和本软件五列均可导入',()=>{const r=importRows('name,category,count,aliases,translation\nlong_hair,0,123,"longhair,long hairs",长发\nblue_eyes,0,12,,蓝眼睛');assert.equal(r.entries[0].translation,'长发');assert.deepEqual(r.entries[0].aliases,['longhair','long hairs']);assert.equal(r.entries[1].category,'通用');});
test('翻译CSV兼容两列与旧三列并能安全再导入新词表格式',()=>{assert.equal(importRows('long_hair,长发','translations').entries[0].translation,'长发');assert.equal(importRows('long_hair,0,长发','translations').entries[0].translation,'长发');const glossary=importRows('name,translation,kind,source\nlong_hair,长发,zh,source note\nidentity,角色原名,原名/身份标注,source info\nmissing,,缺口,checked gap evidence','translations');assert.equal(glossary.entries[0].translation,'长发');assert.equal(glossary.entries[0].source,'source note');assert.equal(glossary.entries[1].translationKind,'原名/身份标注');assert.equal(glossary.entries[1].translation,'角色原名');assert.equal(glossary.entries[1].source,'source info');assert.equal(glossary.skipped,1);const gaps=importRows('name,translation,kind,source\nmissing,,缺口,checked gap evidence','glossary');assert.deepEqual(gaps.entries[0],{name:'missing',translation:'',translationKind:'缺口',source:'checked gap evidence'});const r=importRows('long_hair,长发\nlong_hair,长头发\n,无效','translations');assert.equal(r.entries.length,1);assert.equal(r.entries[0].translation,'长头发');});
test('隐藏标签跨编辑、插入换行、补全、保存和重新启用',()=>{
  let f=parseField('a, (blue eyes:1.3), b,\n\nc,');
  const id=f.lines[0].items[1].id;
  f=toggleTag(f,f.lines[0].id,id);
  f=parseField('a,\nb,\n\nc,',f);
  assert.equal(f.lines[1].items[0].id,id);
  f=acceptCompletion(f,completionAt(f,4),'brown_hair',true).field;
  const d=newDraft();d.groups[0].field=f;f=hydrateDraft(JSON.parse(JSON.stringify(d))).groups[0].field;
  assert.equal(f.text,'a,\nbrown hair,\n\nc,');assert.equal(f.lines[1].items[0].id,id);
  f=toggleTag(f,f.lines[1].id,id);assert.equal(f.text,'a,\n(blue eyes:1.3), brown hair,\n\nc,');
});
test('整行隐藏后保留空行、末尾逗号、顺序和各自的权重',()=>{
  let groups=newDraft('demo','a,\n(x:1.3), y,\n\nz').groups;
  const ids=groups[0].field.lines[1].items.map(t=>t.id);
  groups=editGroups(groups,ids,'hide');assert.equal(groups[0].field.text,'a,\n\n\nz');
  groups=editGroups(groups,[ids[0]],'rename','(red eyes:1.2)');assert.equal(groups[0].field.text,'a,\n\n\nz');
  groups=editGroups(groups,ids,'enable');assert.equal(groups[0].field.text,'a,\n(red eyes:1.2), y,\n\nz');
});
test('删除可见行和全文替换不遗失隐藏项，未完成的括号也可继续输入',()=>{
  const f=parseField('a,\nx, y,\nb,');const id=f.lines[1].items[0].id;
  const hidden=toggleTag(f,f.lines[1].id,id);
  for(const text of ['(unfinished','', 'a,\nb,','\nreplacement, ']){
    const edited=parseField(text,hidden);assert.equal(edited.text,text);assert.equal(outputField(edited),text);
    assert.equal(edited.lines.flatMap(l=>l.items).filter(t=>t.id===id&&t.disabled).length,1);
  }
});
