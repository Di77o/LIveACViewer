import {expect, test, type Page} from '@playwright/test';

const wallCorners = [
  {x: .1, y: .15}, {x: .85, y: .2},
  {x: .9, y: .9}, {x: .1, y: .85},
];
const placement = (page: Page) => page.getByRole('button', {name: 'Air conditioner placement. Drag to move, or use arrow keys.'});

async function markWall(page: Page) {
  await page.getByRole('button', {name: 'Mark wall', exact: true}).click();
  const stage = page.locator('.room-stage');
  await stage.scrollIntoViewIfNeeded();
  const rect = (await stage.boundingBox())!;
  for (const point of wallCorners) await stage.click({position: {x: point.x * rect.width, y: point.y * rect.height}});
  await expect(page.getByText('PLANE SET', {exact: true})).toBeVisible();
}

/** Read the actual painting, excluding the translucent contact shadow. Bitmap
 * pixels must be converted through the displayed canvas rectangle, not DPR:
 * using DPR here would hide the original intrinsic-canvas-size regression.
 */
async function paintedBounds(page: Page) {
  return page.locator('.unit-depth-scene').evaluate(element => {
    const canvas = element as HTMLCanvasElement;
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let left = canvas.width, top = canvas.height, right = -1, bottom = -1;
    for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
      if (pixels[(y * canvas.width + x) * 4 + 3] <= 200) continue;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const rect = canvas.getBoundingClientRect();
    const photo = document.querySelector('.room-photo')!.getBoundingClientRect();
    const selection = document.querySelector('.placed-unit')!.getBoundingClientRect();
    const scaleX = rect.width / canvas.width, scaleY = rect.height / canvas.height;
    const painted = {left: rect.left + left * scaleX, top: rect.top + top * scaleY,
      right: rect.left + (right + 1) * scaleX, bottom: rect.top + (bottom + 1) * scaleY};
    return {hasPaint: right >= left, rendered: canvas.dataset.rendered,
      canvas: {left: rect.left, top: rect.top, width: rect.width, height: rect.height},
      photo: {left: photo.left, top: photo.top, width: photo.width, height: photo.height},
      selection: {left: selection.left, top: selection.top, right: selection.right, bottom: selection.bottom},
      painted, bitmap: {width: canvas.width, height: canvas.height}, dpr: window.devicePixelRatio};
  });
}

async function expectRegistered(page: Page) {
  await expect(async () => {
    const bounds = await paintedBounds(page);
    expect(bounds.rendered).toBe('true');
    expect(bounds.hasPaint).toBe(true);
    for (const edge of ['left', 'top', 'right', 'bottom'] as const)
      expect(Math.abs(bounds.painted[edge] - bounds.selection[edge]), `paint/selection ${edge}`).toBeLessThanOrEqual(4);
    // The photo, canvas and interaction all share CSS coordinates. Only the
    // backing bitmap may be enlarged for Retina resolution (currently capped).
    for (const key of ['left', 'top', 'width', 'height'] as const)
      expect(Math.abs(bounds.canvas[key] - bounds.photo[key]), `canvas/photo ${key}`).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.bitmap.width - bounds.photo.width * Math.min(2, bounds.dpr))).toBeLessThanOrEqual(1);
    expect(Math.abs(bounds.bitmap.height - bounds.photo.height * Math.min(2, bounds.dpr))).toBeLessThanOrEqual(1);
  }).toPass({timeout: 5_000});
  return paintedBounds(page);
}

async function dragUnit(page: Page, dx: number, dy: number) {
  await placement(page).scrollIntoViewIfNeeded();
  const before = await expectRegistered(page);
  const box = (await placement(page).boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, {steps: 5});
  await page.mouse.up();
  const after = await expectRegistered(page);
  const paintedDx = after.painted.left - before.painted.left;
  const paintedDy = after.painted.top - before.painted.top;
  expect(paintedDx).toBeGreaterThan(3);
  expect(paintedDy).toBeGreaterThan(3);
  expect(Math.abs(paintedDx - (after.selection.left - before.selection.left))).toBeLessThanOrEqual(3);
  expect(Math.abs(paintedDy - (after.selection.top - before.selection.top))).toBeLessThanOrEqual(3);
}

for (const deviceScaleFactor of [1, 1.25, 2, 3]) {
  test(`3D painting stays inside its selection at DPR ${deviceScaleFactor}`, async ({browser}, testInfo) => {
    const mobile = testInfo.project.name === 'iphone';
    const viewport = mobile ? {width: 390, height: 844} : {width: 1440, height: 1050};
    const context = await browser.newContext({baseURL: testInfo.project.use.baseURL, viewport,
      deviceScaleFactor, isMobile: mobile, hasTouch: mobile});
    const page = await context.newPage();
    try {
      await page.goto('/');
      await markWall(page);
      await expectRegistered(page);
      await dragUnit(page, mobile ? 18 : 32, mobile ? 14 : 24);

      // Keyboard wall edits and range changes recompute both the painted
      // geometry and its hit area; neither may retain the previous bounds.
      await page.getByRole('button', {name: 'Top right wall corner. Drag or use arrow keys to adjust.'}).press('ArrowDown');
      await expectRegistered(page);
      const initialWidth = await placement(page).evaluate(element => element.getBoundingClientRect().width);
      await page.getByLabel('Visual size').fill('30');
      await expectRegistered(page);
      expect(await placement(page).evaluate(element => element.getBoundingClientRect().width)).toBeGreaterThan(initialWidth);

      // Exercise the square body as well as the default wide unit, including
      // the asynchronous SVG texture load after changing models.
      await page.getByRole('button', {name: /ARTCOOL Gallery Premium.*Wood-look/}).click();
      await expectRegistered(page);
      await page.getByRole('button', {name: 'Expand preview', exact: true}).click();
      await expectRegistered(page);
      await dragUnit(page, 14, 12);

      // Resizing models an orientation change / desktop window resize. The
      // canvas must follow the same contained photo rectangle in both modes.
      await page.setViewportSize(mobile ? {width: 844, height: 390} : {width: 1000, height: 760});
      await expectRegistered(page);
      await page.getByRole('button', {name: 'Close expanded preview'}).click();
      await expectRegistered(page);
      await page.setViewportSize(viewport);
      await expectRegistered(page);
      await page.locator('.room-stage').scrollIntoViewIfNeeded();
      await page.screenshot({path: testInfo.outputPath(`registration-dpr-${deviceScaleFactor}.png`)});
    } finally {
      await context.close();
    }
  });
}
