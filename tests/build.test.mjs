import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, mkdir, writeFile, symlink, rm, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseHtml } from 'parse5';

async function tempSite(prefix) {
  const temp = await mkdtemp(join(tmpdir(), prefix));
  for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
  await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
  return temp;
}
function buildSite(temp) {
  return spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', RESUME_FIXTURE_ONLY: '', ASTRO_TELEMETRY_DISABLED: '1' } });
}
async function walkOutput(dir) {
  return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(e => e.isDirectory() ? walkOutput(join(dir, e.name)) : [join(dir, e.name)]))).flat();
}
function nodesByClass(node, cls) {
  return [...((node.attrs ?? []).some(a => a.name === 'class' && a.value.split(' ').includes(cls)) ? [node] : []), ...(node.childNodes ?? []).flatMap(child => nodesByClass(child, cls))];
}
function nodeText(node) { return (node.value ?? '') + (node.childNodes ?? []).map(nodeText).join(''); }
function imageAlts(node) { return [...(node.tagName === 'img' ? [(node.attrs ?? []).find(attr => attr.name === 'alt')?.value] : []), ...(node.childNodes ?? []).flatMap(imageAlts)]; }

test('S-23 incomplete review, note, empty sections and nested drafts never appear in output', { timeout: 120000 }, async () => {
  const temp = await tempSite('resume-draft-matrix-');
  try {
    const posts = join(temp, 'src/content/blog');
    const published = (title, date) => `---\ntitle: ${title}\ndate: ${date}\nformat: note\ntopic: shared\n---\n${title} prose.\n`;
    await writeFile(join(posts, 'control-new.md'), published('Published New Control', '2025-01-01'));
    await writeFile(join(posts, 'control-old.md'), published('Published Old Control', '2023-01-01'));
    const drafts = [
      ['draft-review.md', 'review', 'shared', 'DraftReviewMarker'],
      ['draft-note-md.md', 'note', 'shared', 'DraftNoteMdMarker'],
      ['draft-note-mdx.mdx', 'note', 'shared', 'DraftNoteMdxMarker'],
      ['draft-empty-md.md', 'review', 'shared', 'DraftEmptyMdMarker'],
      ['draft-comment-md.md', 'review', 'shared', 'DraftCommentMdMarker'],
      ['draft-empty-mdx.mdx', 'review', 'shared', 'DraftEmptyMdxMarker'],
      ['draft-comment-mdx.mdx', 'review', 'shared', 'DraftCommentMdxMarker'],
      ['nested/draft-nested.md', 'review', 'draftonly', 'DraftNestedMarker'],
    ];
    await mkdir(join(posts, 'nested'), { recursive: true });
    for (const [name, format, topic, marker] of drafts) {
      const body = name.includes('empty') ? '## Verdict\n' : name.includes('comment') ? `## Verdict\n\n${name.endsWith('.mdx') ? '{/* hidden */}' : '<!-- hidden -->'}\n` : format === 'review' ? `${marker} body\n` : '';
      await writeFile(join(posts, name), `---\ntitle: ${marker}\ndate: 2024-01-01\nformat: ${format}\ntopic: ${topic}\ndraft: true\n---\n${body}`);
    }
    const result = buildSite(temp); assert.equal(result.status, 0, result.stdout + result.stderr);
    const out = join(temp, 'dist');
    for (const file of await walkOutput(out)) {
      const content = (await readFile(file)).toString('utf8');
      for (const [name, , , marker] of drafts) {
        const slug = name.replace(/\.(md|mdx)$/, '');
        assert.ok(!file.includes(slug), file); assert.ok(!content.includes(slug), `${file}: ${slug}`); assert.ok(!content.includes(marker), `${file}: ${marker}`);
      }
      assert.ok(!file.includes('draftonly') && !content.includes('/writing/topic/draftonly'), file);
    }
    for (const route of ['index.html', 'writing/index.html', 'writing/topic/shared/index.html', 'rss.xml', 'sitemap-0.xml']) {
      const content = await readFile(join(out, route), 'utf8');
      if (route !== 'sitemap-0.xml') { assert.match(content, /Published New Control/); assert.match(content, /Published Old Control/); }
      else { assert.match(content, /control-new/); assert.match(content, /control-old/); }
    }
    const newPost = await readFile(join(out, 'writing/control-new/index.html'), 'utf8');
    const oldPost = await readFile(join(out, 'writing/control-old/index.html'), 'utf8');
    assert.match(newPost, /Published Old Control/); assert.match(oldPost, /Published New Control/);
    await assert.rejects(readFile(join(out, 'writing/topic/draftonly/index.html')));
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('S-23 invalid drafts, future incomplete posts and published empty sections name their files', { timeout: 300000 }, async () => {
  const temp = await tempSite('resume-draft-reject-');
  try {
    const posts = join(temp, 'src/content/blog');
    const cases = [
      ['unknown.md', 'format: unknown\ndate: 2024-01-01\ndraft: true', 'text'],
      ...['', 'date:', 'date: false', 'date: null', 'date: not-a-date'].map((date, i) => [`date-${i}.md`, `format: note\n${date}\ndraft: true`, 'text']),
      ['unknown-field.md', 'format: note\ndate: 2024-01-01\ndraft: true\nunknownField: true', 'text'],
      ['nested/invalid.md', 'format: unknown\ndate: 2024-01-01\ndraft: true', 'text'],
      ['future.md', 'format: review\ndate: 2999-01-01', 'No verdict'],
      ['mixed-empty.md', 'format: review\ndate: 2024-01-01', '## Verdict\n\n### Verdict\n\nSecond verdict only.'],
      ['topic/reserved.md', 'format: review\ndate: 2024-01-01\ndraft: true', 'No verdict'],
      ...['md', 'mdx'].flatMap(ext => [
        [`note-empty.${ext}`, 'format: note\ndate: 2024-01-01', ''],
        [`section-empty.${ext}`, 'format: review\ndate: 2024-01-01', '## Verdict\n'],
        [`section-comment.${ext}`, 'format: review\ndate: 2024-01-01', `## Verdict\n\n${ext === 'mdx' ? '{/* hidden */}' : '<!-- hidden -->'}`],
      ]),
    ];
    for (const [name, meta, body] of cases) {
      const file = join(posts, name); await mkdir(join(file, '..'), { recursive: true });
      await writeFile(file, `---\ntitle: Reject Control\ntopic: software\n${meta}\n---\n${body}\n`);
      const result = buildSite(temp); assert.notEqual(result.status, 0, name); assert.ok((result.stdout + result.stderr).includes(basename(name)), name); await rm(file);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('static check rejects missing query and fragment targets', async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-static-'));
  try {
    await mkdir(join(temp, 'dist')); await mkdir(join(temp, 'tests'));
    await cp('tests/design-placeholders.json', join(temp, 'tests/design-placeholders.json'));
    await writeFile(join(temp, 'dist/404.html'), 'Not found');
    for (const url of ['/missing-query?x=1', '/missing-fragment#part']) {
      await writeFile(join(temp, 'dist/index.html'), `<a href="${url}">link</a>`);
      const result = spawnSync(process.execPath, [resolve('scripts/static-check.mjs')], { cwd: temp, encoding: 'utf8' });
      assert.notEqual(result.status, 0, url); assert.ok((result.stdout + result.stderr).includes(url.split(/[?#]/)[0]), url);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('static pages supply descriptions explicitly', async () => {
  const base = await readFile('src/layouts/Base.astro', 'utf8');
  assert.doesNotMatch(base, /descriptions\[|const descriptions/);
  for (const path of ['index', 'work', 'about', 'plarea', 'contact', '404']) {
    const source = await readFile(`src/pages/${path}.astro`, 'utf8');
    assert.match(source, /<Base\b[^>]*\bdescription=/, path);
  }
});

test('shared prose and neighbor styles have single rules', async () => {
  const css = await readFile('src/styles/global.css', 'utf8');
  for (const selector of ['.post-prose table', '.post-prose pre', '.post-neighbors']) {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    assert.equal((css.match(new RegExp(`(?:^|,)\\s*${escaped}\\s*(?:,|\\{)`, 'gm')) ?? []).length, 1, selector);
  }
  const neighbors = css.match(/\.post-neighbors\s*\{([^}]*)\}/)[1];
  assert.doesNotMatch(neighbors, /flex-wrap|justify-content/);
  assert.match(css, /\.post-prose h2\s*\{[^}]*font-size:\s*var\(--t-h2\)/);
});

test('S-23 footnote-only notes and empty MDX expressions are rejected', { timeout: 120000 }, async () => {
  const temp = await tempSite('resume-nonrender-');
  try {
    const dir = join(temp, 'src/content/blog');
    const cases = [
      ['footnote-note.md', 'note', '[^one]: Only a footnote.'],
      ...['null', 'false', 'undefined', '[]', "''", '""', '/* comment */'].map((expression, i) => [`empty-expression-${i}.mdx`, 'review', `## Verdict\n\n{${expression}}`]),
    ];
    for (const [name, format, body] of cases) {
      const file = join(dir, name);
      await writeFile(file, `---\ntitle: Nonrender control\ndate: 2024-01-01\nformat: ${format}\ntopic: software\n---\n${body}\n`);
      const result = buildSite(temp); assert.notEqual(result.status, 0, name); assert.ok((result.stdout + result.stderr).includes(name), name); await rm(file);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('object-form didnt-only gear renders without a stray zero', { timeout: 120000 }, async () => {
  const temp = await tempSite('resume-gear-');
  try {
    await writeFile(join(temp, 'src/content/blog/gear.md'), '---\ntitle: Gear control\ndate: 2020-01-01\nformat: trip\ntopic: camping\ngear:\n  didnt:\n    - Failed gear control\n---\n## Day 1\n\nA trip.\n');
    const result = buildSite(temp); assert.equal(result.status, 0, result.stdout + result.stderr);
    const doc = parseHtml(await readFile(join(temp, 'dist/writing/gear/index.html'), 'utf8'));
    const gear = nodesByClass(doc, 'gear-notes'); assert.equal(gear.length, 1);
    assert.match(nodeText(gear[0]), /Failed gear control/); assert.doesNotMatch(nodeText(gear[0]), /0/);
    assert.equal(nodesByClass(gear[0], 'gear-worked').length, 0); assert.equal(nodesByClass(gear[0], 'gear-didnt').length, 1);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('S-23 incomplete drafts are excluded while invalid dates remain errors', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-draft-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    const posts = join(temp, 'src/content/blog');
    const run = () => spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    const front = (format, date = 'date: 2020-01-01') => `---\ntitle: Draft Unique Marker\n${date}\nformat: ${format}\ntopic: software\ndraft: true\n---\n`;
    const path = join(posts, 'draft-unique-slug.md');
    await writeFile(path, front('review') + 'Draft Unique Marker\n');
    let result = run(); assert.equal(result.status, 0, result.stdout + result.stderr);
    const fs = await import('node:fs/promises');
    for (const route of ['index.html', 'writing/index.html', 'rss.xml', 'sitemap-0.xml']) {
      const output = await fs.readFile(join(temp, 'dist', route), 'utf8');
      assert.doesNotMatch(output, /Draft Unique Marker|draft-unique-slug/);
    }
    for (const date of ['', 'date:', 'date: false']) {
      await writeFile(path, front('note', date) + 'Text\n');
      result = run(); assert.notEqual(result.status, 0, date); assert.match(result.stdout + result.stderr, /draft-unique-slug\.md/);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('S-23 required sections accept HTML content but reject non-rendering content', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-content-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    const run = () => spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    const front = '---\ntitle: Content test\ndate: 2020-01-01\nformat: deep dive\ntopic: software\n---\n## TL;DR\n\n';
    const fs = await import('node:fs/promises');
    for (const [name, body, valid] of [['html.md', '<div>Visible text</div>', true], ['comment.md', '<!-- hidden -->', false], ['expression.mdx', '{null}', false], ['footnote.md', '[^note]: Footnote definition', false]]) {
      const file = join(temp, 'src/content/blog', name); await writeFile(file, front + body + '\n');
      const result = run();
      if (valid) assert.equal(result.status, 0, result.stdout + result.stderr);
      else { assert.notEqual(result.status, 0, name); assert.match(result.stdout + result.stderr, new RegExp(name.replace('.', '\\.'))); }
      await fs.rm(file);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('root index post coexists with writing index', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-index-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    await writeFile(join(temp, 'src/content/blog/index.md'), '---\ntitle: Index control\ndate: 2020-01-01\nformat: note\ntopic: software\n---\nIndex control prose.\n');
    const result = spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const fs = await import('node:fs/promises');
    assert.match(await fs.readFile(join(temp, 'dist/writing/index.html'), 'utf8'), /Index control/);
    assert.match(await fs.readFile(join(temp, 'dist/writing/index/index.html'), 'utf8'), /Index control prose/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

test('build subheadings are not steps and mixed-depth trip days remain separate', { timeout: 120000 }, async () => {
  const temp = await mkdtemp(join(tmpdir(), 'resume-sections-'));
  try {
    for (const item of ['src', 'public', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
    await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
    const posts = join(temp, 'src/content/blog');
    const front = format => `---\ntitle: Section control\ndate: 2020-01-01\nformat: ${format}\ntopic: software\n---\n`;
    await writeFile(join(posts, 'build.md'), front('build').replace('topic: software\n---', 'topic: software\nsteps:\n  - photo: { src: /first.svg, alt: First step photo }\n  - photo: { src: /second.svg, alt: Second step photo }\n---') + '## Tools\n\n### Table saw\n\nTool details.\n\n## Cut boards\n\nCut details.\n\n### Safety\n\nSafety details.\n\n## Assemble\n\nAssembly details.\n');
    await writeFile(join(posts, 'trip.md'), front('trip').replace('topic: software\n---', 'topic: software\ndays:\n  - meta: [First metadata]\n  - meta: [Second metadata]\n  - meta: [Third metadata]\n---') + '## Day 1\n\nFirst day.\n\n### Day 2\n\nSecond day.\n\n## Day 3\n\nThird day.\n');
    await writeFile(join(posts, 'review.md'), front('review') + '## Verdict\n\nFirst verdict.\n\n### Verdict\n\nSecond ordinary verdict.\n');
    const result = spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, encoding: 'utf8', env: { ...process.env, RESUME_TEST_FIXTURES: '0', RESUME_TEST_EMPTY: '0', ASTRO_TELEMETRY_DISABLED: '1' } });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const fs = await import('node:fs/promises');
    const build = await fs.readFile(join(temp, 'dist/writing/build/index.html'), 'utf8');
    assert.equal((build.match(/class="build-step g12"/g) || []).length, 2);
    const steps = nodesByClass(parseHtml(build), 'build-step');
    assert.match(nodeText(steps[0]), /01.*Cut boards/s); assert.match(nodeText(steps[0]), /Safety details/); assert.doesNotMatch(nodeText(steps[0]), /Assembly details/);
    assert.match(nodeText(steps[1]), /02.*Assemble/s); assert.match(nodeText(steps[1]), /Assembly details/);
    assert.deepEqual(imageAlts(steps[0]), ['First step photo']);
    assert.deepEqual(imageAlts(steps[1]), ['Second step photo']);
    const trip = await fs.readFile(join(temp, 'dist/writing/trip/index.html'), 'utf8');
    assert.equal((trip.match(/class="trip-day g12"/g) || []).length, 3);
    const days = nodesByClass(parseHtml(trip), 'trip-day');
    for (const [i, number, word] of [[0, '1', 'First'], [1, '2', 'Second'], [2, '3', 'Third']]) {
      const text = nodeText(days[i]); assert.match(text, new RegExp(`Day ${number}`)); assert.match(text, new RegExp(`${word} day`)); assert.match(text, new RegExp(`${word} metadata`));
      for (const other of ['First', 'Second', 'Third'].filter(value => value !== word)) assert.doesNotMatch(text, new RegExp(`${other} (day|metadata)`));
    }
    const review = parseHtml(await fs.readFile(join(temp, 'dist/writing/review/index.html'), 'utf8'));
    const verdicts = nodesByClass(review, 'verdict'); assert.equal(verdicts.length, 1);
    assert.match(nodeText(verdicts[0]), /First verdict/); assert.doesNotMatch(nodeText(verdicts[0]), /Second ordinary verdict/);
    assert.match(nodeText(nodesByClass(review, 'review-body')[0]), /Second ordinary verdict/);
  } finally { await rm(temp, { recursive: true, force: true }); }
});

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
    await writeFile(join(base, 'not-found.md'), '---\ntitle: Canonical control\ndate: 2020-01-01\nformat: note\ntopic: software\n---\nAn actual post.\n');
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

test('build steps under a wrapper heading and JSX components satisfy required sections', { timeout: 120000 }, async () => {
  const temp = await tempSite('resume-wrapper-');
  try {
    const posts = join(temp, 'src/content/blog');
    const front = (format, extra = '') => `---\ntitle: Wrapper control\ndate: 2020-01-01\nformat: ${format}\ntopic: software\n${extra}---\n`;
    await writeFile(join(posts, 'wrapper.md'), front('build') + '## The build\n\n### Cut the legs\n\nCut.\n\n### Glue up\n\nGlue.\n');
    await writeFile(join(posts, 'steps.md'), front('build') + '## Steps\n\n### First cut\n\nOne.\n\n### Second cut\n\nTwo.\n');
    await writeFile(join(posts, 'component.mdx'), front('deep dive') + '## TL;DR\n\n<hr />\n');
    const result = buildSite(temp);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    for (const slug of ['wrapper', 'steps']) {
      const html = await readFile(join(temp, `dist/writing/${slug}/index.html`), 'utf8');
      assert.equal((html.match(/class="build-step g12"/g) || []).length, 2, slug);
    }
  } finally { await rm(temp, { recursive: true, force: true }); }
});
