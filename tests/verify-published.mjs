import { mkdtemp, cp, symlink, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import net from 'node:net';
import { publishedVerificationEnv } from './verify-published-env.mjs';
async function availablePortBlock() {
  for (let attempt = 0; attempt < 40; attempt++) {
    const base = 28000 + Math.floor(Math.random() * 20000); const servers = [];
    try {
      for (let offset = 0; offset < 3; offset++) { const server = net.createServer(); servers.push(server); await new Promise((resolve, reject) => { server.once('error', reject); server.listen(base + offset, '127.0.0.1', resolve); }); }
      await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve)))); return base;
    } catch { await Promise.all(servers.map(server => new Promise(resolve => { if (server.listening) server.close(resolve); else resolve(); }))); }
  }
  throw new Error('Unable to reserve three local verification ports');
}
const temp = await mkdtemp(join(tmpdir(), 'resume-verify-published-'));
try {
  for (const item of ['src', 'public', 'tests', 'scripts', 'docs', 'astro.config.mjs', 'wrangler.jsonc', 'package.json', 'package-lock.json', 'tsconfig.json', 'playwright.config.ts']) await cp(item, join(temp, item), { recursive: true });
  await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
  await writeFile(join(temp, 'src/content/blog/published-control.md'), '---\ntitle: My First Post\ndate: 2020-01-01\nformat: note\ntopic: software\n---\nPublished control prose.\n');
  await writeFile(join(temp, 'src/content/blog/phrase-control.md'), '---\ntitle: A My First Post Retrospective\ndate: 2019-01-01\nformat: note\ntopic: software\n---\nA published control.\n');
  const ports = await availablePortBlock();
  const result = spawnSync(process.execPath, ['scripts/verify.mjs'], { cwd: temp, stdio: 'inherit', env: publishedVerificationEnv(process.env, ports) });
  if (result.status !== 0) throw new Error(`Verification with a published post failed (exit ${result.status})`);
  console.log('Verification with an isolated published post passed.');
} finally { await rm(temp, { recursive: true, force: true }); }
