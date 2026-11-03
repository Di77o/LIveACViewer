import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { Server } from 'node:http';

process.env.NODE_ENV = 'test';
const { app } = await import('./index.js');
const originalFetch = globalThis.fetch;
const oldKey = process.env.AC_OPENAI_API_KEY;
const oldOpenAiKey = process.env.OPENAI_API_KEY;
let server: Server;
let base: string;
const image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9z0AAAAASUVORK5CYII=';
const body = { image, model: { name: 'LG unit', widthMm: 837, heightMm: 308 }, wallWidthCm: 400, imageWidth: 1200, imageHeight: 800 };

before(async () => {
  delete process.env.AC_OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  globalThis.fetch = originalFetch;
  if (oldKey === undefined) delete process.env.AC_OPENAI_API_KEY;
  else process.env.AC_OPENAI_API_KEY = oldKey;
  if (oldOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = oldOpenAiKey;
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('health reports that AI needs configuration, with no credential exposure', async () => {
  const response = await originalFetch(`${base}/api/health`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { ok: true, aiConfigured: false, model: process.env.AC_OPENAI_MODEL || 'gpt-4.1-mini' });
});

test('recommendation rejects invalid input and honestly reports unconfigured AI', async () => {
  const invalid = await originalFetch(`${base}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(invalid.status, 400);
  const unconfigured = await originalFetch(`${base}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(unconfigured.status, 503);
  assert.equal((await unconfigured.json() as { code: string }).code, 'AI_NOT_CONFIGURED');
  const crossed = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }];
  const invalidWall = await originalFetch(`${base}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, wallCorners: crossed }) });
  assert.equal(invalidWall.status, 400);
  assert.equal((await invalidWall.json() as { code: string }).code, 'INVALID_REQUEST');
});

test('recommendation submits the photo to the provider and validates the returned placement', async () => {
  process.env.AC_OPENAI_API_KEY = 'test-only-key';
  const wallCorners = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.15 }, { x: 0.85, y: 0.9 }, { x: 0.12, y: 0.9 }];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.ok(init?.signal);
    const request = JSON.parse(init!.body as string);
    assert.equal(request.messages[1].content[1].image_url.url, image);
    assert.deepEqual(JSON.parse(request.messages[1].content[0].text).chosenWallCorners, wallCorners);
    assert.match(request.messages[0].content, /whole visible footprint inside that selected wall polygon/);
    assert.equal(request.response_format.json_schema.strict, true);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ x: 0.5, y: 0.25, width: 0.21, confidence: 'medium', summary: 'Centered on the clear wall.', reasoning: ['Avoids the window.'], warnings: [] }) } }] }), { status: 200 });
  }) as typeof fetch;
  const response = await originalFetch(`${base}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, wallCorners }) });
  assert.equal(response.status, 200);
  const result = await response.json() as { placement: { x: number; warnings: string[] } };
  assert.equal(result.placement.x, 0.5);
  assert.ok(result.placement.warnings.some((warning) => warning.includes('installer')));
});

test('malformed provider output and provider credential failures are handled without exposing response details', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: '{"x":99}' } }] }), { status: 200 })) as typeof fetch;
  const malformed = await originalFetch(`${base}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(malformed.status, 502);
  assert.equal((await malformed.json() as { code: string }).code, 'INVALID_AI_RESPONSE');

  globalThis.fetch = (async () => new Response('Sensitive upstream details', { status: 401 })) as typeof fetch;
  const denied = await originalFetch(`${base}/api/recommend`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(denied.status, 502);
  const error = await denied.text();
  assert.ok(!error.includes('Sensitive'));
  assert.ok(error.includes('AI_AUTH_FAILED'));
});

test('wall detection requires valid photo dimensions and honestly reports unconfigured AI', async () => {
  delete process.env.AC_OPENAI_API_KEY;
  globalThis.fetch = (async () => { throw new Error('Unconfigured requests must not contact the provider.'); }) as typeof fetch;
  for (const invalidBody of [{ image }, { ...body, imageHeight: 0 }, { ...body, image: 'not-a-photo' }]) {
    const response = await originalFetch(`${base}/api/detect-wall`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(invalidBody) });
    assert.equal(response.status, 400);
  }
  const response = await originalFetch(`${base}/api/detect-wall`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, imageWidth: 1200, imageHeight: 800 }) });
  assert.equal(response.status, 503);
  assert.equal((await response.json() as { code: string }).code, 'AI_NOT_CONFIGURED');
});

test('wall detection sends the photo and returns a validated full-photo wall quadrilateral', async () => {
  process.env.AC_OPENAI_API_KEY = 'test-only-key';
  const corners = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.15 }, { x: 0.85, y: 0.9 }, { x: 0.12, y: 0.9 }];
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.ok(init?.signal);
    const submitted = JSON.parse(init!.body as string);
    assert.equal(submitted.messages[1].content[1].image_url.url, image);
    assert.equal(JSON.parse(submitted.messages[1].content[0].text).imageWidth, 1200);
    assert.equal(submitted.response_format.json_schema.name, 'wall_plane');
    assert.equal(submitted.response_format.json_schema.strict, true);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ corners, confidence: 'medium', summary: 'The main wall behind the seating area.', warnings: [] }) } }] }), { status: 200 });
  }) as typeof fetch;
  const response = await originalFetch(`${base}/api/detect-wall`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, imageWidth: 1200, imageHeight: 800 }) });
  assert.equal(response.status, 200);
  const result = await response.json() as { wall: { corners: unknown; warnings: string[] } };
  assert.deepEqual(result.wall.corners, corners);
  assert.ok(result.wall.warnings.some((warning) => /estimate/i.test(warning)));
});

test('wall detection preserves an honest no-wall result and rejects crossed corner output', async () => {
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ corners: null, confidence: 'low', summary: 'No single wall plane is visible.', warnings: ['The photo is too tightly cropped to estimate the boundaries.'] }) } }] }), { status: 200 })) as typeof fetch;
  const missing = await originalFetch(`${base}/api/detect-wall`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, imageWidth: 1200, imageHeight: 800 }) });
  assert.equal(missing.status, 200);
  const result = await missing.json() as { wall: { corners: unknown; confidence: string } };
  assert.equal(result.wall.corners, null);
  assert.equal(result.wall.confidence, 'low');

  const crossed = [{ x: 0.1, y: 0.1 }, { x: 0.9, y: 0.9 }, { x: 0.9, y: 0.1 }, { x: 0.1, y: 0.9 }];
  globalThis.fetch = (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ corners: crossed, confidence: 'high', summary: 'A wall.', warnings: [] }) } }] }), { status: 200 })) as typeof fetch;
  const invalid = await originalFetch(`${base}/api/detect-wall`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, imageWidth: 1200, imageHeight: 800 }) });
  assert.equal(invalid.status, 502);
  assert.equal((await invalid.json() as { code: string }).code, 'INVALID_AI_RESPONSE');
});

test('wall detection and recommendations share the AI request rate limit', async () => {
  globalThis.fetch = (async () => { throw new Error('Rate-limited requests must not contact the provider.'); }) as typeof fetch;
  const response = await originalFetch(`${base}/api/detect-wall`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, imageWidth: 1200, imageHeight: 800 }) });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '600');
  assert.equal((await response.json() as { code: string }).code, 'RATE_LIMITED');
});

test('line refinement validates an existing plane and works without an external AI provider',async()=>{
  const invalid=await originalFetch(`${base}/api/refine-wall-lines`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,wallCorners:[]})});assert.equal(invalid.status,400);
  const {readFile}=await import('node:fs/promises');const photo='data:image/jpeg;base64,'+(await readFile('public/sample-room.jpg')).toString('base64');
  const result=await originalFetch(`${base}/api/refine-wall-lines`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({image:photo,imageWidth:1600,imageHeight:1200,wallCorners:[{x:.1,y:.1},{x:.85,y:.1},{x:.85,y:.6},{x:.1,y:.6}]})});
  assert.equal(result.status,200);const output=await result.json() as {corners:unknown[];lines:unknown[];refined:boolean};assert.equal(output.corners.length,4);assert.ok(Array.isArray(output.lines));assert.equal(typeof output.refined,'boolean');
});
