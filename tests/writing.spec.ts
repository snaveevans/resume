import { test, expect } from '@playwright/test';
import { readdir, readFile, mkdtemp, cp, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { join } from 'node:path';
const port = Number(process.env.VERIFY_PORT_BASE || 18788);
const prod = `http://127.0.0.1:${port}`;
const fixture = `http://127.0.0.1:${port + 1}`;
const empty = `http://127.0.0.1:${port + 2}`;
async function isolatedBuild(options: { single?: string; drafts?: boolean }) {
  const temp = await mkdtemp(join(tmpdir(), 'resume-fixtures-'));
  for (const item of ['src', 'public', 'tests/fixtures', 'astro.config.mjs', 'package.json', 'tsconfig.json']) await cp(item, join(temp, item), { recursive: true });
  await symlink(resolve('node_modules'), join(temp, 'node_modules'), 'dir');
  if (options.drafts) for (const name of ['fixture-draft.md', 'fixture-future.md', 'fixture-note.md']) await cp(join(temp, 'tests/fixtures/posts', name), join(temp, 'src/content/blog', name));
  const env = { ...process.env, ASTRO_TELEMETRY_DISABLED: '1', RESUME_TEST_FIXTURES: options.single ? '1' : '0', RESUME_FIXTURE_ONLY: options.single || '' };
  const result = spawnSync(process.execPath, [resolve('node_modules/astro/astro.js'), 'build'], { cwd: temp, env, encoding: 'utf8' });
  if (result.status !== 0) { await rm(temp, { recursive: true, force: true }); throw new Error(result.stdout + result.stderr); }
  return { temp, out: join(temp, options.single ? 'fixture-dist' : 'dist') };
}

test('S-17 starter posts are gone', async ({ page }) => {
  await page.goto(prod + '/writing');
  const starterTitles = ['First post', 'Second post', 'Third post', 'Markdown Style Guide', 'Using MDX'];
  const starterRoutes = ['first-post', 'second-post', 'third-post', 'markdown-style-guide', 'using-mdx'];
  const links = await page.locator('main a[href]').evaluateAll(els => els.map(el => ({ text: el.textContent?.trim(), path: new URL((el as HTMLAnchorElement).href).pathname.replace(/\/$/, '') })));
  const titles = (await page.locator('.writing-row strong, .latest-content h2 a').allTextContents()).map(title => title.trim().toLowerCase());
  for (const title of starterTitles) expect(titles).not.toContain(title.toLowerCase());
  for (const slug of starterRoutes) expect(links.map(link => link.path)).not.toContain(`/writing/${slug}`);
  if (process.env.VERIFY_PUBLISHED_CHILD) {
    await expect(page.locator('main a[href="/writing/published-control"]')).toContainText('My First Post');
    await expect(page.locator('main a[href="/writing/phrase-control"]')).toContainText('A My First Post Retrospective');
  }
  await page.goto(empty + '/writing');
  await expect(page.locator('main')).toContainText(/nothing.*published|no.*posts.*yet/i);
  await expect(page.getByText('Latest', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: /filter by topic/i })).toHaveCount(0);
  await page.goto(fixture + '/writing');
  await expect(page.getByRole('navigation', { name: /filter by topic/i })).toBeVisible();
});
test('S-18 writing index grouping and single post', async ({ page }) => {
  await page.goto(fixture + '/writing');
  const main = page.locator('main');
  const latest = page.getByRole('region', { name: 'Latest', exact: true });
  await expect(latest.getByRole('heading', { name: 'Fixture Deep Dive', exact: true })).toBeVisible();
  await expect(main.getByText('Fixture Deep Dive', { exact: true })).toHaveCount(1);
  const year2026 = page.getByRole('region', { name: '2026', exact: true });
  const year2025 = page.getByRole('region', { name: '2025', exact: true });
  const rows = (region: typeof year2026) => region.locator('.writing-row');
  const positions = await rows(year2026).first().evaluate(row => ['time', 'strong', 'small'].map(selector => row.querySelector(selector)!.getBoundingClientRect().left));
  expect(positions[0]).toBeLessThan(positions[1]); expect(positions[1]).toBeLessThan(positions[2]);
  await expect(rows(year2026).locator('strong')).toHaveText(['Fixture Build', 'Fixture Trip', 'Fixture Alpha', 'Fixture Beta']);
  await expect(rows(year2026).locator('small')).toHaveText(['build · software', 'trip · camping', 'note · software', 'note · software']);
  await expect(rows(year2025).locator('strong')).toHaveText(['Fixture Review', 'Fixture Note', 'Fixture Populated Build', 'Fixture Populated Trip', 'Fixture Populated Review', 'Fixture Populated Deep Dive', 'Fixture Populated Note', 'Fixture Array Gear', 'Fixture Single']);
  await expect(rows(year2025).locator('small')).toHaveText(['review · software', 'note · software', 'build · software', 'trip · camping', 'review · software', 'deep dive · software', 'note · software', 'trip · camping', 'note · single']);
  expect(await year2026.evaluate((node, later) => !!(node.compareDocumentPosition(document.querySelector(later)!) & Node.DOCUMENT_POSITION_FOLLOWING), 'section[aria-label="2025"]')).toBe(true);
  const single = await isolatedBuild({ single: 'fixture-single' });
  try { await page.setContent(await readFile(join(single.out, 'writing/index.html'), 'utf8'));
    await expect(page.locator('main')).toContainText('Fixture Single');
    await expect(page.locator('main')).toContainText('Latest');
    await expect(page.getByRole('heading', { name: /^202[56]$/ })).toHaveCount(0);
  } finally { await rm(single.temp, { recursive: true, force: true }); }
});
test('S-19 static topic filter', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  await page.goto(fixture + '/writing'); await page.getByRole('link', { name: 'camping', exact: true }).click();
  await expect(page.locator('main')).toContainText('Fixture Trip');
  await expect(page.locator('main')).not.toContainText('Fixture Deep Dive');
  await expect(page.getByText('Latest', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'empty', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'all', exact: true }).click();
  await expect(page.locator('main')).toContainText('Fixture Deep Dive'); await context.close();
});
test('S-20 five post formats', async ({ page }) => {
  for (const [slug, required] of [['deep-dive','TL;DR'], ['build','Step 1'], ['trip','Day 1'], ['review','Verdict'], ['note','Fixture note prose']]) {
    await page.goto(`${fixture}/writing/fixture-${slug}`);
    await expect(page.locator('h1')).toContainText(/Fixture/i); await expect(page.locator('main')).toContainText(required);
    await expect(page.locator('main')).toContainText(/202[56]/); await expect(page.locator('main')).toContainText(/software|camping/i);
    await expect(page.locator('main')).toContainText(new RegExp(slug.replace('-', '[ -]'), 'i'));
  }
  await page.goto(`${fixture}/writing/fixture-populated-build`);
  const heading = page.locator('.build-step .step-text h2').first();
  await expect(heading).toBeVisible();
  await expect(heading).toHaveCSS('border-top-width', '0px');
});
test('S-21 optional sections absent for minimal posts', async ({ page }) => {
  for (const [slug, required] of [['deep-dive', 'TL;DR'], ['build', 'Step 1'], ['trip', 'Day 1'], ['review', 'Verdict'], ['note', 'Fixture note prose']]) {
    const response = await page.goto(`${fixture}/writing/fixture-${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toContainText('Fixture');
    await expect(page.locator('main')).toContainText(required);
    await expect(page.locator('[data-optional-section], .optional-section')).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(/on this page|tradeoffs|cut list|tools|plans|elevation|gear notes|\bpros\b|\bcons\b|specs|results|hero|stats|photo|\blink\b/i);
    await expect(page.locator('main img, main pre, main table')).toHaveCount(0);
  }
  for (const [slug, expected] of [
    ['build', ['Material', 'Pine', 'Cut list', 'Fixture board', 'Tools', 'Fixture saw', 'Plans']],
    ['trip', ['Distance', 'Fixture distance', 'Elevation profile', 'Gear notes', 'Fixture gear']],
    ['review', ['Specs', 'Fixture model', 'Results', 'Fixture result', 'Good', 'Fixture pro', 'Not so good', 'Fixture con']],
    ['deep-dive', ['On this page', 'fixtureCode', 'Tradeoffs', 'Fixture tradeoff']],
    ['note', ['example.com/note']],
  ] as const) {
    expect((await page.goto(`${fixture}/writing/fixture-populated-${slug}`))?.status()).toBe(200);
    for (const value of expected) await expect(page.locator('main')).toContainText(value);
    if (slug !== 'trip') await expect(page.locator('.post-heading > div').first()).toHaveCSS('grid-column-start', ['build', 'review'].includes(slug) ? '1' : '3');
    await expect(page.locator('.post-neighbors .post-previous')).toHaveCSS('grid-column-start', '3');
    await expect(page.locator('.post-neighbors .post-next')).toHaveCSS('grid-column-start', '7');
    if (slug === 'build') {
      const alignment = await page.evaluate(() => { const hero = document.querySelector('.post-hero')!.getBoundingClientRect(), specs = document.querySelector('.build-facts')!.getBoundingClientRect(); return { gap: specs.top - hero.bottom, width: specs.width, viewport: document.documentElement.clientWidth }; });
      expect(alignment.gap).toBe(0); expect(alignment.width).toBe(alignment.viewport);
      await expect(page.locator('dl.post-specs')).toContainText('Pine'); await expect(page.locator('img[alt="Build hero"]')).toBeVisible();
      const ratio = await page.locator('.post-hero').evaluate(el => { const rect = el.getBoundingClientRect(); return rect.width / rect.height; }); expect(ratio).toBeCloseTo(16 / 9, 2);
      await expect(page.getByRole('link', { name: /Plans/ })).toHaveAttribute('href', 'https://example.com/plans');
      await expect(page.locator('.cut-section table')).toContainText('Fixture board'); await expect(page.locator('.cut-section th')).toHaveText(['Part', 'Qty', 'Dimensions', 'Material']);
      await expect(page.locator('.build-step img[alt="Fixture step photo"]')).toBeVisible(); await expect(page.locator('.step-number')).toContainText('01'); await expect(page.locator('main')).toContainText('Fixture change');
    }
    if (slug === 'trip') {
      await expect(page.locator('dl.post-specs dt')).toHaveText(['where', 'Distance', 'gain', 'nights', 'rig / mode']);
      await expect(page.locator('dl.post-specs')).toContainText('Fixture distance'); await expect(page.locator('img[alt="Trip hero"]')).toBeVisible();
      await expect(page.locator('img[alt="Fixture elevation"]')).toBeVisible(); await expect(page.locator('img[alt="Fixture map"]')).toBeVisible();
      await expect(page.locator('.trip-route figcaption')).toContainText('Fixture start'); await expect(page.locator('.trip-route figcaption')).toContainText('Fixture end');
      await expect(page.locator('.trip-day .day-meta')).toContainText('Fixture day distance'); await expect(page.locator('.gear-notes')).toContainText('Fixture failed gear'); await expect(page.locator('main')).toContainText('Fixture next time');
      const width = await page.locator('.trip-cover').evaluate(el => el.getBoundingClientRect().width); expect(width).toBe(await page.evaluate(() => document.documentElement.clientWidth));
      await expect(page.locator('.trip-cover-title')).toHaveCSS('background-image', 'none');
      await expect(page.locator('.trip-cover-title')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
      const overlap = await page.locator('.trip-cover-title').evaluate(el => { const title = el.getBoundingClientRect(), image = el.parentElement!.querySelector('img')!.getBoundingClientRect(); return title.top < image.bottom && title.bottom > image.top; }); expect(overlap).toBe(true);
      const tripAlignment = await page.evaluate(() => {
        const content = document.querySelector('.post-inner')!, strip = document.querySelector('.trip-facts .post-specs')!, nav = document.querySelector('.post-neighbors')!, last = nav.querySelector('a:last-child')!, footer = document.querySelector('footer')!;
        return { content: content.getBoundingClientRect().left + parseFloat(getComputedStyle(content).paddingLeft), stats: strip.getBoundingClientRect().left + parseFloat(getComputedStyle(strip).paddingLeft), rule: nav.getBoundingClientRect().left, bottom: footer.getBoundingClientRect().top - last.getBoundingClientRect().bottom };
      });
      expect(Math.abs(tripAlignment.stats - tripAlignment.content)).toBeLessThan(1); expect(Math.abs(tripAlignment.rule - tripAlignment.content)).toBeLessThan(1); expect(tripAlignment.bottom).toBeGreaterThanOrEqual(48);
      await expect(page.locator('.day-label h2')).toHaveCSS('color', 'rgb(163, 74, 38)'); await expect(page.locator('.day-label h2')).toHaveCSS('font-family', /JetBrains Mono/);
    }
    if (slug === 'note') { await expect(page.locator('img[alt="Fixture photo"]')).toBeVisible(); await expect(page.locator('main a[href="https://example.com/note"]')).toBeVisible(); }
    if (slug === 'deep-dive') {
      await expect(page.locator('aside.post-callout.tldr')).toContainText('Fixture summary in context'); await expect(page.locator('main pre code')).toContainText('fixtureCode');
      await expect(page.locator('.code-caption')).toHaveText('fixture.js'); await expect(page.locator('main pre')).toHaveCSS('border-top-width', '4px');
      await expect(page.locator('main pre')).toHaveCSS('background-color', 'rgb(30, 35, 32)'); await expect(page.locator('main pre')).toHaveCSS('color', 'rgb(226, 221, 207)');
      const colors = await page.locator('main pre span').evaluateAll(els => els.map(el => getComputedStyle(el).color));
      expect(colors).toContain('rgb(217, 154, 108)'); expect(colors).toContain('rgb(169, 188, 148)');
      await expect(page.locator('main table')).toContainText('Fixture tradeoff'); await expect(page.locator('main table th').first()).toHaveCSS('border-bottom-width', '2px');
      await expect(page.locator('.post-toc a')).toHaveText(['TL;DR', 'Context', 'Implementation', 'Tradeoffs']); await expect(page.locator('.post-toc a').first()).toHaveAttribute('aria-current', 'location');
      await expect(page.locator('.margin-notes')).toContainText('Fixture margin note');
      expect(await page.locator('.post-prose').evaluate(el => el.firstElementChild?.classList.contains('tldr'))).toBe(true);
    }
    if (slug === 'review') {
      await expect(page.locator('.review-results table')).toContainText('Fixture result'); await expect(page.locator('.review-results .table-caption')).toContainText('Fixture test conditions');
      await expect(page.locator('.post-heading img[alt="Review photo"]')).toBeVisible(); await expect(page.locator('aside.post-callout.verdict')).toContainText('Fixture verdict in context');
      await expect(page.locator('.review-results td:last-child').first()).toHaveCSS('text-align', 'right');
      for (const text of ['Fixture good use', 'Fixture poor use', '$15', 'Fixture alternative', 'Fixture disclosure']) await expect(page.locator('main')).toContainText(text);
      const specsHeading = await page.locator('.review-specs h2').boundingBox(), contextHeading = await page.locator('.review-body h2').first().boundingBox(), contextParagraph = await page.locator('.review-body p').first().boundingBox();
      expect(specsHeading && contextHeading && contextParagraph).toBeTruthy();
      expect(Math.abs(specsHeading!.y - contextHeading!.y)).toBeLessThan(2); expect(contextParagraph!.y - (contextHeading!.y + contextHeading!.height)).toBeLessThanOrEqual(20);
      const reviewColumns = await page.evaluate(() => { const grid = document.querySelector('.post-layout')!.getBoundingClientRect(), disclosure = document.querySelector('.review-disclosure')!.getBoundingClientRect(); return { expected: grid.left + 2 * ((grid.width - 11 * 24) / 12) + 48, actual: disclosure.left }; });
      expect(Math.abs(reviewColumns.actual - reviewColumns.expected)).toBeLessThan(2);
      expect(await page.locator('.review-alternatives h2').evaluate(el => getComputedStyle(el).fontSize)).toBe(await page.locator('.review-results h2').evaluate(el => getComputedStyle(el).fontSize));
    }
    for (const heading of await page.locator('.post-optional h2').all()) { await expect(heading).toHaveCSS('font-weight', '800'); await expect(heading).toHaveCSS('font-stretch', '75%'); }
  }
  await page.goto(fixture + '/writing/fixture-array-gear');
  await expect(page.locator('.gear-notes')).toContainText('Fixture array gear');
  await expect(page.locator('.gear-notes')).not.toContainText('0');
  await expect(page.locator('.gear-didnt')).toHaveCount(0);
  await expect(page.locator('.day-label h2')).toHaveText('Day 1');
  await expect(page.locator('.day-label h2')).toHaveCSS('color', 'rgb(163, 74, 38)');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const slug of ['build', 'trip', 'review', 'deep-dive', 'note']) {
    await page.goto(`${fixture}/writing/fixture-populated-${slug}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), slug).toBe(true);
    if (slug === 'trip') { const left = await page.locator('.trip-facts .post-specs').evaluate(el => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft)); expect(left).toBe(16); }
    for (const grid of await page.locator('main *').filter({ visible: true }).all()) {
      const columns = await grid.evaluate(el => getComputedStyle(el).display === 'grid' ? getComputedStyle(el).gridTemplateColumns.split(' ').length : 1);
      expect(columns, slug).toBe(1);
    }
  }

});
test('S-22 previous and next', async ({ page }) => {
  await page.goto(fixture + '/writing/fixture-alpha');
  await expect(page.getByRole('link', { name: /previous/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /next/i })).toBeVisible();
  const neighbors = await page.getByRole('link', { name: /previous|next/i }).evaluateAll(links => links.map(link => link.getAttribute('href')));
  expect(neighbors).toEqual(expect.arrayContaining([expect.stringMatching(/fixture-trip/), expect.stringMatching(/fixture-beta/)]));
  await page.goto(fixture + '/writing/fixture-deep-dive');
  await expect(page.getByRole('link', { name: /next/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /previous/i })).toBeVisible();
  await page.goto(fixture + '/writing/fixture-single');
  await expect(page.getByRole('link', { name: /previous/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /next/i })).toBeVisible();
});
async function walk(dir: string): Promise<string[]> { const entries = await readdir(dir, { withFileTypes: true }); return (await Promise.all(entries.map(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]))).flat(); }
test('S-24 fixture content never ships', async () => {
  const names = ['Deep Dive', 'Build', 'Trip', 'Review', 'Note', 'Alpha', 'Beta', 'Single', 'Draft', 'Future', 'Populated Build', 'Populated Trip', 'Populated Review', 'Populated Deep Dive', 'Populated Note', 'Array Gear'];
  const hasFixture = (path: string, content: Buffer) => /fixture|\/test-media\//i.test(path) || names.some(name => content.includes(Buffer.from(`Fixture ${name}`)));
  expect(hasFixture('index.html', Buffer.from('Fixture Deep Dive'))).toBe(true);
  expect(hasFixture('writing/fixture-note/index.html', Buffer.from(''))).toBe(true);
  expect(hasFixture('dist/test-media/hero.svg', Buffer.from(''))).toBe(true);
  for (const file of await walk('dist')) expect(hasFixture(file, await readFile(file)), file).toBe(false);
});
test('S-25 feeds, sitemap and metadata', async ({ request, page }) => {
  for (const path of ['/rss.xml', '/sitemap-index.xml']) {
    const response = await request.get(prod + path); expect(response.ok()).toBe(true);
    const text = await response.text(); expect(text).toContain('<?xml'); expect(text).not.toContain('Fixture');
    const errors = await page.evaluate(xml => new DOMParser().parseFromString(xml, 'application/xml').querySelectorAll('parsererror').length, text); expect(errors).toBe(0);
  }
  const index = await (await request.get(prod + '/sitemap-index.xml')).text();
  const children = await page.evaluate(xml => Array.from(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('loc'), n => n.textContent || ''), index);
  expect(children.length).toBeGreaterThan(0);
  let sitemap = '';
  for (const child of children) { const url = new URL(child); expect(url.origin).toBe('https://www.tylerevans.co'); const response = await request.get(prod + url.pathname); expect(response.ok()).toBe(true); const xml = await response.text(); expect(await page.evaluate(s => new DOMParser().parseFromString(s, 'application/xml').querySelectorAll('parsererror').length, xml)).toBe(0); sitemap += xml; }
  for (const route of ['/writing', '/work', '/about', '/plarea', '/contact']) expect(sitemap).toContain(`https://www.tylerevans.co${route}`);
  expect(sitemap).not.toMatch(/fixture|\/blog\//i);
  const titles = new Set<string>();
  for (const path of ['/', '/writing', '/work', '/about', '/plarea', '/contact', '/404.html']) {
    await page.goto(prod + path); const title = await page.title(); expect(title).toBeTruthy(); expect(titles.has(title)).toBe(false); titles.add(title);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.tylerevans.co${path === '/404.html' ? '/404.html' : path === '/' ? '/' : path + '/'}`);
  }
  const fixtureRss = await (await request.get(fixture + '/rss.xml')).text();
  expect(await page.evaluate(xml => new DOMParser().parseFromString(xml, 'application/xml').querySelectorAll('parsererror').length, fixtureRss)).toBe(0);
  const rssItems = await page.evaluate(xml => Array.from(new DOMParser().parseFromString(xml, 'application/xml').querySelectorAll('item'), item => ({ title: item.querySelector('title')?.textContent, link: item.querySelector('link')?.textContent })), fixtureRss);
  for (const [slug, title] of [['fixture-deep-dive', 'Fixture Deep Dive'], ['fixture-build', 'Fixture Build'], ['fixture-trip', 'Fixture Trip']]) {
    expect(rssItems).toContainEqual({ title, link: `https://www.tylerevans.co/writing/${slug}/` });
    await page.goto(`${fixture}/writing/${slug}`);
    expect(await page.title()).toBe(`${title} · Tyler Evans`);
    expect(titles.has(await page.title())).toBe(false); titles.add(await page.title());
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://www.tylerevans.co/writing/${slug}/`);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', title);
  }
  const fixtureIndex = await (await request.get(fixture + '/sitemap-index.xml')).text();
  const fixtureChildren = await page.evaluate(xml => Array.from(new DOMParser().parseFromString(xml, 'application/xml').getElementsByTagName('loc'), n => n.textContent || ''), fixtureIndex);
  expect(fixtureChildren.length).toBeGreaterThan(0);
  let fixtureSitemap = '';
  for (const child of fixtureChildren) { const response = await request.get(fixture + new URL(child).pathname); expect(response.ok()).toBe(true); const xml = await response.text(); expect(await page.evaluate(s => new DOMParser().parseFromString(s, 'application/xml').querySelectorAll('parsererror').length, xml)).toBe(0); fixtureSitemap += xml; }
  for (const slug of ['fixture-deep-dive', 'fixture-build', 'fixture-trip']) expect(fixtureSitemap).toContain(`https://www.tylerevans.co/writing/${slug}/`);
  const fixtureTitles = [];
  for (const slug of ['fixture-deep-dive', 'fixture-build', 'fixture-trip']) { await page.goto(`${fixture}/writing/${slug}`); fixtureTitles.push(await page.title()); }
  expect(new Set(fixtureTitles).size).toBe(fixtureTitles.length);

});
test('S-26 drafts and future posts are absent', async () => {
  const build = await isolatedBuild({ drafts: true });
  try {
    const listing = await readFile(join(build.out, 'writing/index.html'), 'utf8');
    expect(listing).toContain('Fixture Note');
    for (const file of await walk(build.out)) {
      expect(file).not.toMatch(/fixture-(draft|future)/i);
      const content = await readFile(file);
      expect(content.toString('utf8')).not.toMatch(/fixture[- ](?:draft|future)/i);
    }
  } finally { await rm(build.temp, { recursive: true, force: true }); }
});
