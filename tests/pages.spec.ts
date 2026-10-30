import { test, expect } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const placeholders = JSON.parse(await readFile('tests/design-placeholders.json', 'utf8')) as string[];
const prod = `http://127.0.0.1:${Number(process.env.VERIFY_PORT_BASE || 18788)}`;
const empty = `http://127.0.0.1:${Number(process.env.VERIFY_PORT_BASE || 18788) + 2}`;

test('S-06 production contains no design placeholders', async () => {
  expect(placeholders.length).toBeGreaterThan(0);
  const hasPlaceholder = (text: string) => /lorem ipsum|\bTODO\b/i.test(text) || placeholders.some(p => text.includes(p));
  expect(hasPlaceholder(`Example ${placeholders[0]}`)).toBe(true);
  async function htmlFiles(dir: string): Promise<string[]> {
    return (await Promise.all((await readdir(dir, { withFileTypes: true })).map(entry => entry.isDirectory() ? htmlFiles(join(dir, entry.name)) : entry.name.endsWith('.html') ? [join(dir, entry.name)] : []))).flat();
  }
  const files = await htmlFiles('dist');
  expect(files.length).toBeGreaterThan(0);
  for (const path of files) {
    const html = await readFile(path, 'utf8');
    const { parse } = await import('parse5');
    const visible = (node: any): string => ['script', 'style', 'pre', 'code'].includes(node.tagName) ? '' : (node.value || '') + (node.attrs || []).filter((a: any) => ['alt', 'title', 'aria-label'].includes(a.name)).map((a: any) => a.value).join(' ') + (node.childNodes || []).map(visible).join(' ');
    const text = visible(parse(html));
    expect(hasPlaceholder(text), path).toBe(false);
  }
});
test('S-07 missing facts are omitted', async ({ page }) => {
  for (const route of ['/contact', '/work', '/about']) {
    await page.goto(prod + route);
    await expect(page.locator('a[href^="mailto:"], a[href$=".pdf"], [aria-label*="placeholder" i]')).toHaveCount(0);
    expect(await page.locator('img').evaluateAll(images => images.filter(img => !img.getAttribute('src') || !(img as HTMLImageElement).naturalWidth).length)).toBe(0);
    await expect(page.locator('body')).not.toContainText(/\[(?:email|portrait|role|bullet)/i);
  }
});
test('S-08 content gaps record what is needed', async () => {
  const text = await readFile('docs/content-gaps.md', 'utf8');
  for (const term of [/email/i, /summary/i, /role bullets/i, /other projects/i, /pdf/i, /portrait/i, /photos/i, /now/i]) expect(text).toMatch(term);
});
test('S-09 home sections', async ({ page }) => {
  await page.goto(prod + '/');
  const selectors = ['main h1', '[data-ridge]', '[data-facts]', '.home-writing', '.home-work', '.accent-block', 'footer.footer-full'];
  for (const selector of selectors) await expect(page.locator(selector)).toHaveCount(1);
  const inOrder = await page.evaluate(selectors => {
    const nodes = selectors.map(selector => document.querySelector(selector)!);
    return nodes.slice(1).every((node, i) => Boolean(nodes[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING));
  }, selectors);
  expect(inOrder).toBe(true);
  await expect(page.locator('.home-work .role-row')).toHaveCount(3);
  await expect(page.locator('[data-ridge]')).toBeVisible();
  await expect(page.locator('[data-facts]')).toBeVisible();
  await expect(page.locator('footer')).toContainText(/GitHub/i);
  await expect(page.locator('main')).toContainText(/Staff Software Engineer/);
  await expect(page.locator('main')).toContainText(/Front End Architect/);
  await expect(page.locator('main')).toContainText(/Senior Software Engineer/);
});
test('S-10 home without posts', async ({ page }) => {
  await page.goto(empty + '/');
  await expect(page.getByText(/nothing.*published|no.*posts.*yet/i)).toBeVisible();
  await expect(page.locator('main a[href="/writing"]')).toBeVisible();
});
test('S-11 résumé roles and education', async ({ page }) => {
  await page.goto(prod + '/work');
  const text = await page.locator('main').innerText();
  const roles = ['Staff Software Engineer', 'Front End Architect', 'Senior Software Engineer', 'Software Engineer', 'Web Developer', 'Help Desk Tech'];
  let pos = -1;
  for (const role of roles) { pos = text.indexOf(role, pos + 1); expect(pos).toBeGreaterThanOrEqual(0); }
  for (const term of ['May 2025', 'present', '7 Oaks Group', 'Desert Mutual', 'Plarea', 'Projects', 'Education', 'Weber State']) expect(text).toContain(term);
});
test('S-12 résumé print', async ({ page }) => {
  await page.goto(prod + '/work'); await page.emulateMedia({ media: 'print' });
  await expect(page.locator('header')).toBeHidden(); await expect(page.locator('footer')).toBeHidden();
  for (const button of await page.locator('button, [role="button"]').all()) await expect(button).toBeHidden();
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
});
test('S-13 about copy, fishing photo, facts and real topics', async ({ page }) => {
  await page.goto(prod + '/about');
  for (const phrase of ['I’m a husband to my amazing wife', 'I’ve been building software professionally for over a decade', 'Outside of work, I’m a maker at heart', 'I’m passionate about learning, growing, and pushing myself', 'Thanks for stopping by']) await expect(page.locator('main')).toContainText(phrase);
  await expect(page.locator('main img[alt*="fish" i]')).toBeVisible();
  await expect(page.locator('[data-facts]')).toBeVisible();
  await expect(page.locator('main')).not.toContainText(/\[One line\.\]|\[n\] posts/);
});
test('S-14 Plarea', async ({ page }) => {
  await page.goto(prod + '/plarea'); await expect(page.locator('h1')).toContainText(/Plarea/i);
  await expect(page.locator('main')).toContainText('We make small worlds');
  await expect(page.locator('main a[href="https://www.plarea.dev"]')).toBeVisible();
});
test('S-15 contact and 404', async ({ page, request }) => {
  await page.goto(prod + '/contact');
  await expect(page.locator('main a[href*="github.com"]')).toBeVisible();
  await expect(page.locator('main a[href*="linkedin.com"]')).toBeVisible();
  expect((await request.get(prod + '/a-nonexistent-page')).status()).toBe(404);
  await page.goto(prod + '/a-nonexistent-page');
  await expect(page.locator('[data-ridge]')).toBeVisible(); await expect(page.getByRole('heading', { name: 'Off trail' })).toBeVisible();
  await expect(page.locator('main a[href="/"]')).toBeVisible();
});
test('S-16 old blog redirects', async ({ request }) => {
  for (const path of ['/blog', '/blog/', '/blog/a/b']) {
    const response = await request.get(prod + path, { maxRedirects: 0 });
    expect([301, 308]).toContain(response.status()); expect(response.headers().location).toBe('/writing');
  }
  expect((await request.get(prod + '/blogger', { maxRedirects: 0 })).status()).toBe(404);
});
