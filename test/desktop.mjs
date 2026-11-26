import {_electron as electron} from 'playwright';
import {checkBatchDrag} from './batch-drag.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'test-output');
await fs.mkdir(out,{recursive:true});
const data=await fs.mkdtemp(path.join(out,'firefly-desktop-')),errors=[],checks=[];
const env={...process.env,CIXU_DATA_DIR:data,CIXU_HEADLESS:'1'};delete env.ELECTRON_RUN_AS_NODE;
const pass=name=>{checks.push(name);console.log('PASS',name);};
const launch=()=>electron.launch({args:[root],env,timeout:90000});
let app=await launch(),page=await app.firstWindow();
page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
const editor=page.getByTestId('prompt-editor'),role=(name)=>page.getByRole('button',{name,exact:true});
const chip=name=>page.locator('.chip-main').filter({has:page.locator('.chip-en',{hasText:new RegExp('^\\s*'+name+'\\s*$')})});
try{
  await editor.first().waitFor({timeout:60000});await page.setViewportSize({width:1500,height:920});
  const initial=await page.evaluate(()=>window.cixu.call('app.init'));
  assert.equal(initial.themeSource,'system');
  assert.equal(initial.version,'1.0.0');assert.equal(initial.workspace.drafts[0].groups.length,1);assert.ok(initial.stats.total>210000);assert.ok(initial.stats.pending>0);
  assert.equal(initial.workspace.settings.theme,'system');assert.equal(initial.workspace.settings.tagFontSize,13);assert.equal(initial.workspace.settings.fireflies,true);
  assert.ok(await page.locator('canvas.fireflies').count());
  await page.evaluate(async()=>{await document.fonts.load('12px Outfit');await document.fonts.load('12px "JetBrains Mono"');});
  assert.equal(await page.evaluate(()=>document.fonts.check('12px Outfit')),true);assert.equal(await page.evaluate(()=>document.fonts.check('12px "JetBrains Mono"')),true);
  pass('真实 Vite/Electron 入口载入流萤组件与离线字体');
  await checkBatchDrag(page,out);pass('真实鼠标框选、浮动操作栏、跨组整批拖放及一次撤销');

  await page.getByRole('radio',{name:'Gelbooru'}).click();
  const gel=await page.evaluate(()=>window.cixu.call('app.init'));assert.equal(gel.source,'gelbooru');assert.ok(gel.stats.total>230000);
  await page.getByRole('radio',{name:'Danbooru'}).click();
  assert.equal((await page.evaluate(()=>window.cixu.call('app.init'))).source,'danbooru');pass('切换并隔离实际 Danbooru 与 Gelbooru 词库');

  await editor.first().fill('长发');await page.getByRole('option',{name:/long hair/}).first().waitFor();await editor.first().press('Tab');assert.equal(await editor.first().inputValue(),'long hair, ');
  await editor.first().fill('long hair, blue eyes,\n\nwhite shirt, window,');await editor.first().press('Escape');
  await chip('long hair').click();await page.getByText(/中文释义.*长发/).last().waitFor();
  await chip('long hair').dblclick();assert.ok(await page.locator('.chip.off').count());assert.equal(await editor.first().inputValue(),'blue eyes,\n\nwhite shirt, window,');
  await chip('long hair').dblclick();assert.ok(await page.locator('.chip.off').count()===0);
  await page.locator('.pg').first().locator('.pg-copy').click();
  assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'long hair, blue eyes,\n\nwhite shirt, window,');
  pass('中文补全、标签释义、隐藏/恢复与复制');

  const raw=await editor.first().inputValue(),compact=raw.replaceAll(', ', ',');
  await role('设置 · Ctrl+,').click();await page.getByRole('tab',{name:'复制格式'}).click();
  const spaces=page.getByLabel('保留标签之间的空格',{exact:false});
  assert.equal(await spaces.isChecked(),true);await spaces.uncheck();
  assert.equal(await page.locator('pre.preview').textContent(),compact);
  await role('关闭窗口').click();await editor.first().press('Control+Enter');
  await page.waitForFunction(()=>document.querySelector('.toast')?.textContent.includes('已复制'));
  assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),compact);
  await role('复制全部').click();
  assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),compact);
  assert.equal(await editor.first().inputValue(),raw);pass('复制空格开关、预览、Ctrl+Enter 和复制全部与草稿原文独立');

  await role('设置 · Ctrl+,').click();await page.getByRole('tab',{name:'桌面行为'}).click();
  const shortcutState=()=>page.evaluate(async()=>(await window.cixu.call('app.init')).workspace.settings.shortcut);
  const caps=page.locator('.shortcut-capture kbd');
  await role('设置快捷键').click();assert.equal(await role('确认').isDisabled(),true);
  await page.keyboard.down('Control');assert.deepEqual(await caps.allTextContents(),['Ctrl']);await page.keyboard.up('Control');
  await page.keyboard.press('Control+Shift+F7');assert.deepEqual(await caps.allTextContents(),['Ctrl','Shift','F7']);
  await role('取消').click();assert.equal(await shortcutState(),initial.workspace.settings.shortcut);
  await role('设置快捷键').click();await page.keyboard.press('Control+Alt+F7');await role('重新录制').click();
  assert.equal(await role('确认').isDisabled(),true);await page.keyboard.press('Control+Alt+Shift+F8');
  assert.deepEqual(await caps.allTextContents(),['Ctrl','Alt','Shift','F8']);
  await page.getByRole('dialog',{name:'设置唤起快捷键'}).screenshot({path:path.join(out,'shortcut-recorder.png')});
  await role('确认').click();await role('设置快捷键').waitFor();
  const bound='CommandOrControl+Alt+Shift+F8';
  assert.equal(await shortcutState(),bound);
  assert.equal(await app.evaluate(({globalShortcut},key)=>globalShortcut.isRegistered(key),bound),true);
  // Simulate the native registration refusal deterministically, keeping the old OS registration alive.
  await app.evaluate(({globalShortcut})=>{
    const register=globalShortcut.register;
    globalShortcut.register=function(key,callback){
      if(key==='CommandOrControl+Alt+F9'){globalShortcut.register=register;return false;}
      return register.call(this,key,callback);
    };
  });
  await role('设置快捷键').click();await page.keyboard.press('Control+Alt+F9');await role('确认').click();
  await page.getByRole('alert').filter({hasText:'占用'}).waitFor();
  assert.equal(await shortcutState(),bound);
  assert.equal(await app.evaluate(({globalShortcut},key)=>globalShortcut.isRegistered(key),bound),true);
  await role('重新录制').click();await page.keyboard.press('Escape');await role('设置快捷键').waitFor();await role('关闭窗口').click();
  pass('快捷键实时显示、重录、取消、系统注册和占用失败回退');

  await chip('long hair').click();await page.getByRole('button',{name:'编辑释义'}).click();
  await page.getByLabel('中文内容类型').selectOption('说明');await page.getByLabel('内容来源').fill('Firefly 测试来源');
  await page.getByRole('button',{name:'保存词条'}).click();
  await page.getByText(/说明.*长发/).last().waitFor();
  const noteTag=await page.evaluate(()=>window.cixu.call('tags.lookup',{names:['long_hair']}));
  assert.equal(noteTag['long hair'].translation_kind,'说明');assert.equal(noteTag['long hair'].translation_source,'Firefly 测试来源');
  pass('翻译/说明类型和释义来源标识');

  await editor.first().fill('smlie');await page.getByRole('option',{name:/smlie/}).first().waitFor();await editor.first().press('Tab');await chip('smlie').click();
  const gapTag=await page.evaluate(()=>window.cixu.call('tags.lookup',{names:['smlie']}));assert.equal(gapTag.smlie.translation,'');assert.equal(gapTag.smlie.translation_kind,'缺口');assert.match(gapTag.smlie.translation_source,/research-030/);
  await page.getByText(/待考证.*暂无可靠中文释义/).waitFor();await page.getByText(/已核查来源\/原因：research-030/).waitFor();
  pass('真缺口显示待考证状态与逐条核查来源');

  await chip('smlie').click({button:'right'});const inline=page.getByLabel('当前标签');await inline.fill('sunlight');await inline.press('Enter');assert.match(await editor.first().inputValue(),/sunlight/);
  await role('新建提示词组').click();assert.equal(await editor.count(),2);
  await page.getByLabel('提示词组名称').nth(1).fill('光线');
  assert.match(await page.locator('.bg-head').nth(1).innerText(),/光线/);
  await editor.nth(1).fill('indoors,');await editor.nth(1).press('Escape');
  await chip('sunlight').dragTo(page.locator('.bg').nth(1).locator('.row').first(),{targetPosition:{x:8,y:10}});
  assert.match(await editor.nth(1).inputValue(),/sunlight/);assert.doesNotMatch(await editor.first().inputValue(),/sunlight/);
  const handle=page.getByRole('separator',{name:'调整提示词组高度'}).nth(1),old=await page.locator('.pg-stage').nth(1).evaluate(e=>e.clientHeight),h=await handle.boundingBox();
  await page.mouse.move(h.x+h.width/2,h.y+3);await page.mouse.down();await page.mouse.move(h.x+h.width/2,h.y+28,{steps:4});await page.mouse.up();assert.ok(await page.locator('.pg-stage').nth(1).evaluate(e=>e.clientHeight)>old);
  const resizeTo=async target=>{const body=page.locator('.pg-body').nth(1),bodyBox=await body.boundingBox(),resize=await handle.boundingBox(),height=Math.round(bodyBox.height);await page.mouse.move(resize.x+resize.width/2,resize.y+4);await page.mouse.down();await page.mouse.move(resize.x+resize.width/2,resize.y+4+target-height,{steps:4});await page.mouse.up();await page.keyboard.press('Control+s');await page.getByRole('button',{name:/已自动保存/}).waitFor();assert.equal(await page.locator('.error-banner').count(),0);const persisted=await page.evaluate(()=>window.cixu.call('app.init'));assert.equal(persisted.workspace.drafts[0].groups[1].height,target);};
  await resizeTo(72);await resizeTo(84);pass('72/84px 分组高度经过真实界面保存并写入 SQLite');
  const group2=page.locator('.pg').nth(1);await group2.getByRole('button',{name:'隐藏提示词组'}).click();assert.equal(await editor.count(),1);await group2.getByRole('button',{name:'启用提示词组'}).click();assert.equal(await editor.count(),2);
  pass('分组新建/命名、跨组拖动、调整高度、隐藏与恢复');

  await editor.first().fill('solo, looking at viewer,\nlong hair, hairclip,\nblue eyes, light smile,');await editor.first().press('Escape');
  await editor.nth(1).fill('white shirt, pleated skirt,\nwindow, warm lighting,');await editor.nth(1).press('Escape');
  await role('调整 long hair').click();await page.getByRole('toolbar',{name:'调整当前标签'}).getByRole('button',{name:'收藏标签'}).click();await page.keyboard.press('Escape');
  const first=await page.locator('.row').first().boundingBox(),last=await page.locator('.row').last().boundingBox();
  await page.mouse.move(first.x+first.width-2,first.y+1);await page.mouse.down();await page.mouse.move(first.x+1,last.y+last.height-1,{steps:8});await page.locator('.marquee').waitFor();await page.mouse.up();
  assert.ok(await page.locator('.chip.sel').count()>=4);await role('隐藏选中标签').click();assert.ok(await page.locator('.chip.off').count()>=4);
  await role('启用选中标签').click();await role('删除选中标签').click();assert.equal(await page.getByTestId('tag-chip').count(),0);await role('撤销 · Ctrl+Z').click();assert.ok(await page.getByTestId('tag-chip').count()>=4);
  pass('收藏与批量框选、隐藏、删除、撤销');

  const sideHandle=page.locator('.side-resize'),sideBefore=Number(await page.locator('.app').evaluate(e=>parseFloat(getComputedStyle(e).getPropertyValue('--side-w')))),sideBox=await sideHandle.boundingBox();
  await page.mouse.move(sideBox.x+sideBox.width/2,sideBox.y+80);await page.mouse.down();await page.mouse.move(sideBox.x+sideBox.width/2+28,sideBox.y+80,{steps:4});await page.mouse.up();
  await role('设置 · Ctrl+,').click();
  await page.getByLabel('提示词字号增大').click();await page.getByLabel('标签视图字号增大').click();
  await page.getByLabel('萤火微光').uncheck();assert.equal(await page.locator('canvas.fireflies').count(),0);
  await page.getByRole('button',{name:'深色'}).click();
  await page.getByRole('button',{name:'跟随'}).click();
  await page.screenshot({path:path.join(out,'firefly-settings-1.0.0.png')});
  assert.equal(await page.locator('.error-banner').count(),0);assert.equal(await page.locator('.save-state.error').count(),0);
  await page.getByLabel('萤火微光').check();assert.ok(await page.locator('canvas.fireflies').count());
  await page.getByRole('button',{name:/关闭窗口/}).click();
  await page.waitForTimeout(900);
  const saved=await page.evaluate(()=>window.cixu.call('app.init'));
  assert.equal(saved.themeSource,'system');
  assert.equal(saved.workspace.settings.theme,'system');assert.equal(saved.workspace.settings.tagFontSize,14);assert.equal(saved.workspace.settings.fireflies,true);assert.ok(saved.workspace.settings.sidebarWidth>=sideBefore+20);
  assert.ok(await page.evaluate(()=>getComputedStyle(document.querySelector('.app')).getPropertyValue('--tag-font').trim()==='14px'));
  await page.screenshot({path:path.join(out,'firefly-workbench-1.0.0.png')});pass('主题、标签字号、萤火开关写入 SQLite 并生效');
  assert.equal(await page.locator('.error-banner').count(),0);assert.equal(await page.locator('.save-state.error').count(),0);

  await app.close();app=await launch();page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));
  await page.getByTestId('prompt-editor').first().waitFor({timeout:60000});
  const restarted=await page.evaluate(()=>window.cixu.call('app.init'));
  assert.equal(restarted.themeSource,'system');
  assert.equal(restarted.workspace.settings.keepTagSpaces,false);assert.equal(restarted.workspace.settings.shortcut,bound);
  assert.equal(restarted.workspace.settings.theme,'system');assert.equal(restarted.workspace.settings.tagFontSize,14);assert.equal(restarted.workspace.settings.fireflies,true);
  assert.equal(restarted.workspace.drafts[0].groups[1].height,84);
  assert.equal(restarted.workspace.drafts[0].groups.length,2);assert.equal(restarted.workspace.drafts[0].groups[0].field.text,'solo, looking at viewer,\nlong hair, hairclip,\nblue eyes, light smile,');
  assert.ok(await page.locator('canvas.fireflies').count());assert.equal(restarted.source,'danbooru');
  assert.deepEqual(errors,[]);pass('关闭重启后恢复草稿、Firefly 设置、主题和字体效果');
  await fs.writeFile(path.join(out,'firefly-desktop-report.json'),JSON.stringify({checks,danbooru:initial.stats,gelbooru:gel.stats,errors,settings:restarted.workspace.settings},null,2));
}catch(e){await page.screenshot({path:path.join(out,'firefly-failure-1.0.0.png')}).catch(()=>{});throw e;}finally{await app.close();}

