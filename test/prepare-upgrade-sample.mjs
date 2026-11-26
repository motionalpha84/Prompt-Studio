import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import {setTimeout as pause} from 'node:timers/promises';

const root=path.resolve(import.meta.dirname,'..');
const exe=process.env.CIXU_LEGACY_EXE||path.join(root,'release/词序-Prompt-Studio-0.3.0.exe');
const sample=path.join(root,'test-output/upgrade-sample-0.3.0');
const data=path.join(sample,'data');
await fs.access(exe);await fs.mkdir(sample,{recursive:true});
const env={...process.env,CIXU_DATA_DIR:data,CIXU_HEADLESS:'1'};delete env.ELECTRON_RUN_AS_NODE;
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
let child,browser,page;
try{
  const debuggingPort=await port();child=spawn(exe,[`--remote-debugging-port=${debuggingPort}`,'--remote-debugging-address=127.0.0.1'],{cwd:sample,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
  let ws;const deadline=Date.now()+120000;
  while(Date.now()<deadline){try{const res=await fetch(`http://127.0.0.1:${debuggingPort}/json/version`);if(res.ok){ws=(await res.json()).webSocketDebuggerUrl;break;}}catch{}if(child.exitCode!==null&&child.exitCode!==0)throw new Error(`0.3.0 EXE exited (${child.exitCode}): ${logs}`);await pause(200);}
  if(!ws)throw new Error(`0.3.0 EXE did not start: ${logs}`);
  browser=await chromium.connectOverCDP(ws);const context=browser.contexts()[0];page=context.pages()[0]||await context.waitForEvent('page');
  await page.getByTestId('prompt-editor').waitFor({timeout:60000});
  const editor=page.getByTestId('prompt-editor').first();
  await editor.fill('long hair, black hair,\n\nblue eyes, light smile,');await editor.press('Escape');
  await page.keyboard.press('Control+s');
  await page.waitForFunction(async()=>{const i=await window.cixu.call('app.init');return i.workspace.drafts[0].groups[0].field.text.includes('blue eyes, light smile,');},{},{timeout:30000});
  let init=await page.evaluate(()=>window.cixu.call('app.init'));
  init.workspace.drafts[0].title='0.3 用户升级样本';
  init.workspace.settings.theme='dark';
  await page.evaluate(w=>window.cixu.call('state.save',{workspace:w}),init.workspace);
  const saved=await page.evaluate(async()=>{
    const prior=await window.cixu.call('app.init');
    for(const s of prior.snippets.filter(x=>x.name==='0.3 用户片段'))await window.cixu.call('snippets.delete',{id:s.id});
    for(const p of prior.presets.filter(x=>x.name==='0.3 用户方案'))await window.cixu.call('presets.delete',{id:p.id});
    const custom=await window.cixu.call('tags.save',{name:'long_hair',translation:'用户自定义长发译名',translationKind:'zh',translationSource:'0.3.0 用户来源',category:'我的分类',aliases:['我的长发别名'],note:'0.3.0 用户备注'});
    const blank=await window.cixu.call('tags.save',{name:'my_intentional_blank',translation:'',category:'个人测试',aliases:[],note:'刻意留空'});
    const current=await window.cixu.call('tags.lookup',{names:['long_hair']});if(!current['long hair']?.favorite)await window.cixu.call('tags.favorite',{name:'long_hair'});
    await window.cixu.call('snippets.save',{id:'portable-upgrade-sample-snippet',name:'0.3 用户片段',category:'升级样本',text:'soft lighting, warm lighting,'});
    await window.cixu.call('presets.save',{id:'portable-upgrade-sample-preset',name:'0.3 用户方案',category:'升级样本',draft:(await window.cixu.call('app.init')).workspace.drafts[0]});
    return {custom,blank};
  });
  if(saved.custom?.tag?.translation!=='用户自定义长发译名'||saved.blank?.tag?.translation!=='')throw new Error('0.3.0 API did not preserve the expected personal tag fixtures.');
  const report={sourceExe:exe,dataDir:data,sourceVersion:'0.3.0',fixtures:{draftTitle:init.workspace.drafts[0].title,draftText:init.workspace.drafts[0].groups[0].field.text,theme:'dark',customTranslation:saved.custom.tag.translation,customSource:saved.custom.tag.translation_source||'',customCategory:saved.custom.tag.category,customAlias:saved.custom.tag.aliases,customNote:saved.custom.tag.note,intentionalBlank:saved.blank.tag.name,favorite:'long_hair',snippet:'0.3 用户片段',preset:'0.3 用户方案'}};
  await fs.writeFile(path.join(sample,'upgrade-sample.json'),JSON.stringify(report,null,2));
  console.log('Prepared isolated 0.3.0 upgrade sample:',data);
}finally{
  await page?.evaluate(()=>window.cixu.call('app.close')).catch(()=>{});
  await browser?.close().catch(()=>{});
  if(child){const deadline=Date.now()+10000;while(child.exitCode===null&&Date.now()<deadline)await pause(100);if(child.exitCode===null)child.kill();}
}
