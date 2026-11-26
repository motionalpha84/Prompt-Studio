import assert from 'node:assert/strict';
import path from 'node:path';

export async function checkBatchDrag(page,out){
  const editor=page.getByTestId('prompt-editor').first();
  const firstRow=page.locator('.board [data-line]').first();
  const multiline='1girl, solo, cowboy shot, straight-on,\n\nblue eyes,\n';
  await editor.fill(multiline);await editor.press('Escape');
  await page.getByRole('button',{name:'新建提示词组'}).click();
  const otherEditor=page.getByTestId('prompt-editor').nth(1);
  await otherEditor.fill('white shirt, long hair,');await otherEditor.press('Escape');await page.getByRole('button',{name:/已自动保存/}).waitFor();
  const sourceChips=firstRow.locator('[data-token]');
  const a=await sourceChips.nth(0).boundingBox(),b=await sourceChips.nth(1).boundingBox();
  await page.mouse.move(a.x-1,a.y+1);await page.mouse.down();
  await page.mouse.move(b.x+b.width-2,b.y+b.height-2,{steps:8});await page.mouse.up();
  const batch=page.getByRole('toolbar',{name:'批量标签操作'});
  const selectedChips=page.locator('.board .chip.sel');
  await batch.waitFor();assert.equal(await selectedChips.count(),2);
  const checkAnchor=async()=>{
    const edges=await selectedChips.evaluateAll(chips=>chips.map(el=>el.getBoundingClientRect().bottom));
    const box=await batch.boundingBox();
    assert.ok(Math.abs(box.y-Math.max(...edges)-7)<1,'批量操作栏应紧贴选区底边');
  };
  await checkAnchor();
  const boardBox=await page.locator('.board').boundingBox(),toolbarBox=await batch.boundingBox();
  await page.screenshot({path:path.join(out,'batch-toolbar.png'),clip:{x:boardBox.x,y:boardBox.y,width:boardBox.width,height:Math.ceil(toolbarBox.y+toolbarBox.height-boardBox.y+12)}});
  const destination=page.locator('.board .bg').nth(1).locator('[data-token]').last();
  const target=await destination.boundingBox();
  const emptyRow=page.locator('.board .empty-line').first(),blank=await emptyRow.boundingBox();
  await page.mouse.move(b.x+12,b.y+10);await page.mouse.down();
  await page.mouse.move(b.x+24,b.y+10,{steps:4});
  await batch.waitFor({state:'hidden'});
  await page.mouse.move(blank.x+10,blank.y+blank.height/2,{steps:4});
  await page.mouse.move(blank.x+11,blank.y+blank.height/2);
  await page.locator('.board .ins-empty').waitFor();
  assert.ok(Math.abs((await destination.boundingBox()).y-target.y)<1,'经过空行时插入线不应移动目标标签');
  await page.mouse.move(target.x+5,target.y+10,{steps:10});await page.mouse.move(target.x+6,target.y+10);
  await page.mouse.up();await batch.waitFor();
  assert.equal(await editor.inputValue(),'cowboy shot, straight-on,\n\nblue eyes,\n');
  assert.equal(await otherEditor.inputValue(),'white shirt, 1girl, solo, long hair,');
  assert.equal(await selectedChips.count(),2);await checkAnchor();
  await page.getByRole('button',{name:'撤销 · Ctrl+Z'}).click();
  assert.equal(await editor.inputValue(),multiline);assert.equal(await otherEditor.inputValue(),'white shirt, long hair,');
  await page.locator('.pg').nth(1).getByRole('button',{name:'删除提示词组'}).click();
  await page.getByRole('button',{name:'确认删除'}).click();await otherEditor.waitFor({state:'detached'});
}
