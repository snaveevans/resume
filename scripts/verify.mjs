import { spawn, spawnSync } from 'node:child_process';
import { mkdir, rm, readFile, access } from 'node:fs/promises';
import { resolve } from 'node:path';
const gate = process.env.VERIFY_GATE || 'final';
if (!['1', '2', 'final'].includes(gate)) throw new Error('VERIFY_GATE must be 1, 2, or final');
const max = gate === '1' ? 5 : gate === '2' ? 16 : 26;
const state = resolve('.verify-state');
await mkdir(state, { recursive: true });
// Content-layer caches can hold Markdown rendered by older plugins, so always build clean.
for (const dir of ['.astro-cache', 'node_modules/.astro']) await rm(resolve(dir), { recursive: true, force: true });
const env = { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', RESUME_FIXTURE_ONLY: '', ASTRO_TELEMETRY_DISABLED: '1', WRANGLER_SEND_METRICS: 'false', WRANGLER_HOME: state, XDG_CONFIG_HOME: state, XDG_CACHE_HOME: state };
const run = (command, args) => spawnSync(command, args, { env, stdio: 'inherit' }).status ?? 1;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
let failed = false;
for (const [cmd, args] of [[npm, ['exec', '--', 'astro', 'check']], [npm, ['run', 'build']], [npm, ['run', 'build:fixtures']], [npm, ['run', 'build:empty']]]) {
  if (run(cmd, args)) failed = true;
}
try { await access('dist/404.html'); } catch { console.error('Missing dist/404.html'); failed = true; }
const staticStatus = run(process.execPath, ['scripts/static-check.mjs']);
if (staticStatus) failed = true;
const buildStatus = run(process.execPath, ['--test', 'tests/build.test.mjs']);
if (buildStatus && max >= 23) failed = true;
else if (buildStatus) console.log('S-23 is pending outside this gate.');
const browserCheck = spawnSync(process.execPath, ['--input-type=module', '-e', "import { chromium } from '@playwright/test'; import { access } from 'node:fs/promises'; await access(chromium.executablePath());"], { env, stdio: 'ignore' });
if (browserCheck.status !== 0 && run(npm, ['exec', '--', 'playwright', 'install', 'chromium'])) failed = true;
const port = Number(env.VERIFY_PORT_BASE || 18788);

const children = [];
function server(dir, port) {
  const p = spawn(process.execPath, [resolve('node_modules/wrangler/bin/wrangler.js'), 'pages', 'dev', dir, '--port', String(port), '--ip', '127.0.0.1', '--inspector-port', String(port + 10000)], { env, stdio: 'inherit', detached: process.platform !== 'win32' });
  children.push(p); return p;
}
async function ready(port, child) {
  for (let i = 0; i < 120; i++) {
    if (child.exitCode !== null) throw new Error(`Wrangler on ${port} exited ${child.exitCode}`);
    try { await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(500) }); return; } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error(`Wrangler on ${port} did not become ready`);
}
function shutdown() { for (const child of children) { if (child.exitCode === null) { try { if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGTERM'); else child.kill('SIGTERM'); } catch {} } } }
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { shutdown(); process.exit(1); });
process.on('exit', shutdown);
try {
  await rm(resolve(state, 'playwright.json'), { force: true });
  const a = server('dist', port), b = server('fixture-dist', port + 1), c = server('empty-dist', port + 2);
  await Promise.all([ready(port, a), ready(port + 1, b), ready(port + 2, c)]);
  const status = run(npm, ['exec', '--', 'playwright', 'test']);
  let report;
  try { report = JSON.parse(await readFile(resolve(state, 'playwright.json'), 'utf8')); } catch { throw new Error(`Playwright failed to produce a report (exit ${status})`); }
  const found = new Map();
  function visit(suite) {
    for (const spec of suite.specs || []) {
      const id = Number(spec.title.match(/S-(\d\d)/)?.[1]);
      if (!id || found.has(id)) throw new Error(`Missing or duplicate scenario ID: ${spec.title}`);
      found.set(id, spec.tests.every(t => t.status === 'expected' && t.results.some(r => r.status === 'passed')));
    }
    for (const child of suite.suites || []) visit(child);
  }
  for (const suite of report.suites) visit(suite);
  for (let id = 1; id <= 26; id++) {
    if (id === 23) continue;
    if (!found.has(id)) { console.error(`Missing S-${String(id).padStart(2, '0')}`); failed = true; }
    else if (!found.get(id)) { console.log(`S-${String(id).padStart(2, '0')}: ${id <= max ? 'FAIL' : 'pending'}`); if (id <= max) failed = true; }
  }
  if (status && [...found.values()].every(Boolean)) failed = true;
} catch (error) { console.error(error); failed = true; }
finally { shutdown(); }
if (!failed && !env.VERIFY_PUBLISHED_CHILD && run(process.execPath, ['tests/verify-published.mjs'])) failed = true;
process.exitCode = failed ? 1 : 0;
