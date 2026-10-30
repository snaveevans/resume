import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('S-23 invalid posts fail the build and name the file', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-invalid-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    const posts = join(temp, 'src/content/blog'); await mkdir(posts, { recursive: true });
    const cases = [
      ['invalid-format.md', 'title: Invalid format\ndescription: Invalid format\ndate: 2025-01-01\nformat: unknown\ntopic: software', 'Text'],
      ['missing-date.md', 'title: Missing date\ndescription: Missing date\nformat: note\ntopic: software', 'Text'],
      ['missing-section.md', 'title: Missing section\ndescription: Missing section\ndate: 2025-01-01\nformat: review\ntopic: software', 'Text'],
    ];
    const failures = [];
    for (const [file, frontmatter, body] of cases) {
      const path = join(posts, file); await writeFile(path, `---\n${frontmatter}\n---\n${body}\n`);
      const result = spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_FIXTURE_ONLY: '', ASTRO_TELEMETRY_DISABLED: '1' } });
      if (result.status === 0) failures.push(`${file} must reject build`);
      else if (!new RegExp(file.replace('.', '\\.')).test(result.stdout + result.stderr)) failures.push(`error must name ${file}`);
      await rm(path);
    }
    assert.deepEqual(failures, []);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('nested posts, parsed required sections and supported named steps', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-markdown-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    const dir = join(temp, 'src/content/blog/nested'); await mkdir(dir, { recursive: true });
    const path = join(dir, 'test.md');
    const run = () => spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    const post = (format, body, extra = '') => `---\ntitle: Nested Test\ndate: 2025-01-01\nformat: ${format}\ntopic: software\n${extra}---\n${body}\n`;
    for (const body of ['## Step 1: Cut boards\n\nCut the boards.', '## Milling stock\n\nMill the stock.']) {
      await writeFile(path, post('build', body)); const result = run(); assert.equal(result.status, 0, result.stdout + result.stderr);
      await import('node:fs/promises').then(fs => fs.access(join(temp, 'dist/writing/nested/test/index.html')));
    }
    await rm(path);
    const mdx = join(dir, 'mdx-post.mdx');
    await writeFile(mdx, post('deep dive', '## Context\n\nContext first.\n\n## TL;DR\n\nMDX summary.'));
    const mdxResult = run(); assert.equal(mdxResult.status, 0, mdxResult.stdout + mdxResult.stderr);
    const rendered = await import('node:fs/promises').then(fs => fs.readFile(join(temp, 'dist/writing/nested/mdx-post/index.html'), 'utf8'));
    assert.match(rendered, /post-callout tldr/); assert.ok(rendered.indexOf('post-callout tldr') < rendered.indexOf('Context first.'));
    await rm(mdx);
    let emptyResult = run(); assert.equal(emptyResult.status, 0, emptyResult.stdout + emptyResult.stderr);
    await assert.rejects(import('node:fs/promises').then(fs => fs.access(join(temp, 'dist/writing/nested/test/index.html'))));
    for (const [format, heading] of [['deep dive','TL;DR'], ['review','Verdict'], ['build','Step 1'], ['trip','Day 1']]) {
      await writeFile(path, post(format, `\`\`\`md\n## ${heading}\nNot a real section.\n\`\`\``));
      const result = run(); assert.notEqual(result.status, 0, `${format} must reject a fenced heading`); assert.match(result.stdout + result.stderr, /test\.md/);
    }
    await writeFile(path, post('build', '## Introduction\n\nNo steps here.'));
    let result = run(); assert.notEqual(result.status, 0); assert.match(result.stdout + result.stderr, /test\.md/);
    await writeFile(path, post('note', 'Real prose.', 'unknownField: true\n'));
    result = run(); assert.notEqual(result.status, 0); assert.match(result.stdout + result.stderr, /test\.md/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('published production and isolated empty build', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-empty-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    await writeFile(join(temp, 'src/content/blog/published-control.md'), '---\ntitle: Published Control\ndate: 2020-01-01\nformat: note\ntopic: software\n---\nPublished control prose.\n');
    const run = (empty) => spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: empty ? '1' : '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    for (const empty of [false, true]) { const result = run(empty); assert.equal(result.status, 0, result.stdout + result.stderr); }
    const fs = await import('node:fs/promises');
    assert.match(await fs.readFile(join(temp, 'dist/writing/index.html'), 'utf8'), /Published Control/);
    for (const route of ['index.html', 'writing/index.html']) {
      const html = await fs.readFile(join(temp, 'empty-dist', route), 'utf8');
      assert.match(html, /Nothing is published yet/); assert.doesNotMatch(html, /Published Control/);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('published verification inherits each gate', async () => {
  const { publishedVerificationEnv } = await import('./verify-published-env.mjs');
  for (const gate of ['1', '2', 'final']) assert.equal(publishedVerificationEnv({ VERIFY_GATE: gate }, 31000).VERIFY_GATE, gate);
  assert.equal(publishedVerificationEnv({}, 31000).VERIFY_GATE, 'final');
});

test('reserved topic paths fail with the source filename', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-reserved-'));
  try {
    for (const item of ['src', 'public', 'tests/fixtures', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    const source = join(temp, 'src/content/blog');
    const run = fixture => spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: fixture ? '1' : '0', RESUME_TEST_EMPTY: '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    const body = '---\ntitle: Reserved\ndate: 2020-01-01\nformat: note\ntopic: software\n---\nReal prose.\n';
    for (const relative of ['topic/software.md', 'Topic/Software.mdx', 'topic/nested/post.md', 'topic/index.md']) {
      const file = join(source, relative); await mkdir(join(file, '..'), { recursive: true }); await writeFile(file, body);
      const result = run(false); assert.notEqual(result.status, 0, relative); assert.match(result.stdout + result.stderr, /reserved topic route/); assert.ok((result.stdout + result.stderr).toLowerCase().includes(basename(relative).toLowerCase())); await rm(file);
    }
    const fixture = join(temp, 'tests/fixtures/posts/topic/example.md'); await mkdir(join(fixture, '..'), { recursive: true }); await writeFile(fixture, body);
    const rejected = run(true); assert.notEqual(rejected.status, 0); assert.match(rejected.stdout + rejected.stderr, /topic\/example\.md/); await rm(fixture);
    const allowed = join(source, 'topics/software.md'); await mkdir(join(allowed, '..'), { recursive: true }); await writeFile(allowed, body);
    const result = run(false); assert.equal(result.status, 0, result.stdout + result.stderr);
    await import('node:fs/promises').then(fs => fs.access(join(temp, 'dist/writing/topics/software/index.html')));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('comments do not satisfy required sections, including MDX', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-comments-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    const run = () => spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    const front = '---\ntitle: Test\ndate: 2020-01-01\nformat: deep dive\ntopic: software\n---\n';
    for (const [name, body] of [['comment.md', '## TL;DR\n\n<!-- hidden -->'], ['comment.mdx', '## TL;DR\n\n{/* hidden */}']]) {
      const path = join(temp, 'src/content/blog', name); await writeFile(path, front + body);
      const result = run(); assert.notEqual(result.status, 0, name); assert.ok((result.stdout + result.stderr).includes(name)); assert.match(result.stdout + result.stderr, /required section must contain text/); await rm(path);
    }
    const path = join(temp, 'src/content/blog/visible.mdx'); await writeFile(path, front + '## TL;DR\n\n<div>Visible MDX text</div>\n');
    const result = run(); assert.equal(result.status, 0, result.stdout + result.stderr);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('callouts only hoist the first supported heading and canonical uses the route', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-callout-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    const base = join(temp, 'src/content/blog');
    await writeFile(join(base, 'review.md'), '---\ntitle: Review case\ndate: 2020-01-01\nformat: review\ntopic: software\n---\n#### Verdict\n\nIgnored fourth-level section.\n\n### Verdict\n\nFirst actual verdict.\n\n## Context\n\nMiddle text.\n\n## Verdict\n\nSecond ordinary verdict.\n');
    await writeFile(join(base, 'not-found.md'), '---\ntitle: Not found\ndate: 2020-01-01\nformat: note\ntopic: software\n---\nAn actual post.\n');
    await writeFile(join(base, 'step.md'), '---\ntitle: Step case\ndate: 2020-01-01\nformat: build\ntopic: software\n---\n### Milling stock\n\nA real step.\n');
    await writeFile(join(base, 'deep.md'), '---\ntitle: Deep case\ndate: 2020-01-01\nformat: deep dive\ntopic: software\nonThisPage: true\n---\n### TL;DR\n\nA real summary.\n');
    await writeFile(join(base, 'deep-off.md'), '---\ntitle: Deep without navigation\ndate: 2020-01-01\nformat: deep dive\ntopic: software\nonThisPage: false\n---\n## TL;DR\n\nA real summary.\n');
    const result = spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const fs = await import('node:fs/promises');
    const review = await fs.readFile(join(temp, 'dist/writing/review/index.html'), 'utf8');
    assert.equal((review.match(/class="post-callout verdict"/g) || []).length, 1);
    assert.ok(review.indexOf('First actual verdict') < review.indexOf('Ignored fourth-level section'));
    assert.ok(review.indexOf('Middle text') < review.indexOf('Second ordinary verdict'));
    assert.match(review, /<h4[^>]*>Verdict<\/h4>/); assert.match(review, /<h2[^>]*>Verdict<\/h2>/);
    const step = await fs.readFile(join(temp, 'dist/writing/step/index.html'), 'utf8'); assert.match(step, /<h2[^>]*>Milling stock<\/h2>/);
    const deep = await fs.readFile(join(temp, 'dist/writing/deep/index.html'), 'utf8'); assert.match(deep, /<h2[^>]*>TL;DR<\/h2>/); assert.match(deep, /aria-label="On this page"/);
    const deepOff = await fs.readFile(join(temp, 'dist/writing/deep-off/index.html'), 'utf8'); assert.doesNotMatch(deepOff, /aria-label="On this page"/);
    const post = await fs.readFile(join(temp, 'dist/writing/not-found/index.html'), 'utf8'); assert.match(post, /rel="canonical" href="https:\/\/www\.tylerevans\.co\/writing\/not-found\/"/);
    const notFound = await fs.readFile(join(temp, 'dist/404.html'), 'utf8'); assert.match(notFound, /rel="canonical" href="https:\/\/www\.tylerevans\.co\/404\.html"/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});
