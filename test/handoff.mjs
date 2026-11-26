import {chromium} from 'playwright';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=path.resolve(import.meta.dirname,'..'),html=path.resolve(process.argv[2]||path.join(root,'../Frontend-Handoff/index.html'));
const {version}=JSON.parse(await fs.readFile(path.join(path.dirname(html),'package.json'),'utf8'));
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
  const p=await browser.newPage({viewport:{width:1500,height:900}}),errors=[],external=[];
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});p.on('request',r=>{if(/^https?:/.test(r.url()))external.push(r.url());});
  await p.goto(pathToFileURL(html).href);await p.getByTestId('prompt-editor').first().waitFor();
  const init=await p.evaluate(()=>window.cixu.call('app.init'));
  assert.equal(init.version,version);assert.equal(init.source,'danbooru');assert.equal(init.stats.total,13);assert.equal(init.stats.pending,1);
  const missing=await p.evaluate(()=>window.cixu.call('tags.lookup',{names:['smlie']}));assert.equal(missing.smlie.translation,'');assert.equal(missing.smlie.translation_kind,'缺口');assert.match(missing.smlie.translation_source,/research-030/);
  const search=p.getByLabel('搜索词库');await search.fill('smlie');await p.getByTitle('插入 smlie').waitFor();await p.getByTitle('插入 smlie').click();
  const chip=p.locator('.chip-main').filter({has:p.locator('.chip-en',{hasText:/^\s*smlie\s*$/})});await chip.click();
  await p.getByText(/待考证.*暂无可靠中文释义/).waitFor();await p.getByText(/已核查来源\/原因：research-030/).waitFor();
  await p.getByRole('radio',{name:'Gelbooru'}).click();const switched=await p.evaluate(()=>window.cixu.call('app.init'));assert.equal(switched.source,'gelbooru');assert.equal(switched.stats.total,10);
  const gel=await p.evaluate(()=>window.cixu.call('tags.search',{query:'hair_past_waist',limit:5}));assert.equal(gel.items[0].name,'hair_past_waist');
  const editor=p.getByTestId('prompt-editor').first();await editor.fill('long hair');await p.getByRole('option',{name:/long hair/}).first().waitFor();await editor.press('Tab');assert.equal(await editor.inputValue(),'long hair, ');
  await p.getByRole('button',{name:'新建提示词组'}).click();await p.getByTestId('prompt-editor').nth(1).fill('长发');await p.getByRole('option',{name:/long hair/}).waitFor();await p.getByTestId('prompt-editor').nth(1).press('Tab');
  await p.getByLabel('提示词组名称').nth(1).fill('浏览器测试');await p.keyboard.press('Control+s');await p.getByRole('button',{name:/已自动保存/}).waitFor();
  await p.reload();await p.getByTestId('prompt-editor').nth(1).waitFor();assert.equal(await p.getByLabel('提示词组名称').nth(1).inputValue(),'浏览器测试');assert.equal((await p.evaluate(()=>window.cixu.call('app.init'))).source,'gelbooru');
  assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  console.log('PASS file:// 流萤 UI 载入、版本与真实示例、待考证来源、双站切换、中文补全、草稿保存重载及无外网请求。');
}finally{await browser.close();}
