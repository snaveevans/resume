import { readdir, readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { parse } from 'parse5';
const root = resolve('dist');
await stat(join(root, '404.html'));
async function walk(dir) { return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]))).flat(); }
const files = await walk(root);
const failures = [];
const placeholders = JSON.parse(await readFile('tests/design-placeholders.json', 'utf8'));
function visible(node) { if (['script','style','pre','code'].includes(node.tagName)) return ''; return (node.value || '') + (node.attrs || []).filter(a => ['alt','title','aria-label'].includes(a.name)).map(a => a.value).join(' ') + (node.childNodes || []).map(visible).join(' '); }
for (const file of files.filter(f => f.endsWith('.html'))) {
  const html = await readFile(file, 'utf8');
  const text = visible(parse(html));
  if (/lorem ipsum|\bTODO\b/i.test(text) || placeholders.some(p => text.includes(p))) failures.push(`${file}: placeholder`);
  for (const match of html.matchAll(/(?:href|src)="(\/[^"#?]*)"/g)) {
    const target = join(root, decodeURIComponent(match[1]));
    let exists = false;
    for (const candidate of [target, join(target, 'index.html'), target + '.html']) { try { if ((await stat(candidate)).isFile()) { exists = true; break; } } catch {} }
    if (!exists) failures.push(`${file}: missing ${match[1]}`);
  }
}
assert.deepEqual(failures, [], 'static output issues');
console.log(`Static output: ${files.length} files checked; 404.html exists.`);
