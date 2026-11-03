import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Package the actual production app, not a separate screenshot/demo.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const hosted = process.argv.includes('--hosted');
const mime = { '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff2': 'font/woff2' };
const dataUrl = async file => `data:${mime[path.extname(file)] || 'application/octet-stream'};base64,${(await readFile(file)).toString('base64')}`;
let html = await readFile(path.join(dist, 'index.html'), 'utf8');
const script = html.match(/<script\b[^>]*src="(\/assets\/[^\"]+)"[^>]*><\/script>/);
const stylesheet = html.match(/<link\b[^>]*rel="stylesheet"[^>]*href="(\/assets\/[^\"]+)"[^>]*>/);
if (!script || !stylesheet) throw new Error('Expected one production JS entry and stylesheet. Run npm run build first.');
let js = await readFile(path.join(dist, script[1]), 'utf8');
let css = await readFile(path.join(dist, stylesheet[1]), 'utf8');

async function inlinePublic(directory, prefix = '') {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relative = `${prefix}/${entry.name}`;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await inlinePublic(file, relative);
    else if (mime[path.extname(file)]) {
      const data = await dataUrl(file);
      js = js.replaceAll(relative, data);
      html = html.replaceAll(`href="${relative}"`, `href="${data}"`);
    }
  }
}
await inlinePublic(path.join(root, 'public'));
for (const match of [...css.matchAll(/url\((?:["'])?(\/assets\/[^)'"\s]+)(?:["'])?\)/g)]) {
  css = css.replaceAll(match[0], `url("${await dataUrl(path.join(dist, match[1]))}")`);
}
if (/\b(?:from|import)\s*["']\.\//.test(js)) throw new Error('Unexpected separate JS module; cannot create a self-contained file.');
html = html.replace(script[0], () => `<script>window.${hosted ? '__LIVEAC_STATIC__' : '__LIVEAC_LOCAL__'}=true;</script>\n    <script type="module">${js.replace(/<\/script/gi, '<\\/script')}</script>`);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
if (!hosted) html = html.replace('<title>LiveAC — Find its place.</title>', '<title>LiveAC Studio — Local edition</title>');
const output = hosted ? path.join(root, 'exports', 'hosted', 'index.html') : path.join(root, 'exports', 'LiveAC-Studio.html');
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, html);
console.log(`Created ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB). Open directly in Chrome; no server or installation needed.`);
