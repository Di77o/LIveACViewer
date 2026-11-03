import {test,expect} from '@playwright/test';
const quad=[{x:.1,y:.15},{x:.85,y:.2},{x:.9,y:.9},{x:.1,y:.85}];
async function wall(page:import('@playwright/test').Page){await page.getByRole('button',{name:'Mark wall',exact:true}).click();const stage=page.locator('.room-stage');await stage.scrollIntoViewIfNeeded();const box=(await stage.boundingBox())!;for(const p of quad)await stage.click({position:{x:p.x*box.width,y:p.y*box.height}});}
test('Gallery retains square proportions on an angled wall even with uncertain dimensions',async({page})=>{await page.goto('/');await page.getByRole('button',{name:/ARTCOOL Gallery Premium.*Wood-look/}).click();await wall(page);await page.getByLabel('3D unit depth').uncheck();await expect(page.getByLabel(/Keep original unit proportions/)).toBeChecked();for(const [w,h]of [[420,250],[800,180]]){await page.getByLabel(/Marked wall width/).fill(String(w));await page.getByLabel(/Marked wall height/).fill(String(h));const ratio=await page.locator('.placed-unit').evaluate(el=>{const r=el.getBoundingClientRect();return r.width/r.height;});expect(ratio).toBeCloseTo(1,2);}const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save my preview'}).click();expect(await (await download).failure()).toBeNull();});
test('fast local detection applies an editable plane without a language-model consent dialog',async({page})=>{
 let sent=false;
 await page.route('**/api/local-status',r=>r.fulfill({json:{available:true,state:'ready'}}));
 await page.route('**/api/local-detect-wall',r=>{sent=true;return r.fulfill({json:{wall:{provider:'local-segmentation',corners:quad,confidence:'medium',summary:'Suggested wall.',warnings:['Confirm corners.'],widthGuess:null,timingMs:450,candidates:[{corners:quad}]}}});});
 await page.goto('/');await page.getByRole('button',{name:'Find wall',exact:true}).click();
 await expect(page.getByText('PLANE SET',{exact:true})).toBeVisible();expect(sent).toBe(true);
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.locator('button.wall-corner')).toHaveCount(4);
 await expect(page.getByText('Suggested plane — adjust the corners · 0.5 s')).toBeVisible();
 await expect(page.getByLabel(/Marked wall width/)).toHaveValue('420');
});

test('3D unit has visible depth, follows wall edits and exports the same view',async({page})=>{
 await page.goto('/');await wall(page);
 await expect(page.getByLabel('3D unit depth')).toBeChecked();
 await expect(page.locator('.unit-depth-scene')).toHaveAttribute('data-rendered','true');
 expect(Number(await page.locator('.unit-depth-scene').getAttribute('data-visible-faces'))).toBeGreaterThan(0);
 const before=await page.locator('.placed-unit').getAttribute('style');
 await page.getByRole('button',{name:'Air conditioner placement. Drag to move, or use arrow keys.'}).press('ArrowRight');
 expect(await page.locator('.placed-unit').getAttribute('style')).not.toBe(before);
 await page.getByRole('button',{name:'Top right wall corner. Drag or use arrow keys to adjust.'}).press('ArrowDown');
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save my preview'}).click();expect(await (await download).failure()).toBeNull();
 await page.getByRole('button',{name:/ARTCOOL Gallery Premium.*Wood-look/}).click();await expect(page.locator('.unit-depth-scene')).toBeVisible();
 await page.getByLabel('3D unit depth').uncheck();await expect(page.locator('.unit-depth-scene')).toHaveCount(0);
 await expect(page.getByLabel(/Keep original unit proportions/)).toBeChecked();
});
