import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const port = Number(process.env.VERIFY_PORT_BASE || 18788);
const base = `http://127.0.0.1:${port}`;
const fixture = `http://127.0.0.1:${port + 1}`;
const routes = [
  '/', '/writing', '/work', '/about', '/plarea', '/contact', '/404.html',
  `${fixture}/writing/fixture-note`, `${fixture}/writing/topic/software`,
  ...['build', 'trip', 'review', 'deep-dive', 'note'].map(format => `${fixture}/writing/fixture-populated-${format}`),
];
const sections = ['/writing', '/work', '/about', '/plarea', '/contact'];

test('S-01 primary navigation and current section', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const nav = page.getByRole('navigation', { name: /primary/i });
    for (const section of sections) {
      const link = nav.locator(`a[href="${section}"]`);
      await expect(link).toHaveCount(1);
      if (new URL(route, base).pathname === section || new URL(route, base).pathname.startsWith(`${section}/`)) {
        await expect(link).toHaveAttribute('aria-current', 'page');
        await expect(link).toHaveCSS('color', 'rgb(163, 74, 38)');
      } else await expect(link).not.toHaveAttribute('aria-current', /^(page|step|location|date|time|true)$/);
    }
  }
});

test('S-02 phone layout', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 844 });
  await page.goto('/work');
  expect(await page.locator('main.container').evaluate(el => el.getBoundingClientRect().left + parseFloat(getComputedStyle(el).paddingLeft))).toBe(Math.max(32, (await page.evaluate(() => document.documentElement.clientWidth) - 1264) / 2 + 32));
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of routes) {
    await page.goto(route);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const item of await page.locator('main pre, main table').all()) {
      const withinBox = await item.evaluate(el => { let node: Element | null = el; while (node && node.closest('main')) { const style = getComputedStyle(node); if (node.scrollWidth > node.clientWidth && /auto|scroll/.test(style.overflowX)) return true; node = node.parentElement; } return el.scrollWidth <= el.clientWidth; });
      expect(withinBox).toBe(true);
    }
    const grids = page.locator('main *').filter({ visible: true });
    for (const grid of await grids.all()) {
      const columns = await grid.evaluate(el => getComputedStyle(el).display === 'grid' ? getComputedStyle(el).gridTemplateColumns.split(' ').length : 1); expect(columns).toBe(1);
    }
  }
});

test('S-03 fonts are self-hosted', async ({ page }) => {
  for (const route of routes) {
    const fontRequests: string[] = []; const serviceRequests: string[] = [];
    const listener = (request: import('@playwright/test').Request) => { if (request.resourceType() === 'font') fontRequests.push(request.url()); if (/fonts\.(googleapis|gstatic)\.com|use\.typekit\.net/i.test(request.url())) serviceRequests.push(request.url()); };
    page.on('request', listener);
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => document.fonts.check('400 16px Archivo') && document.fonts.check('400 16px "JetBrains Mono"'))).toBe(true);
    expect(fontRequests.length).toBeGreaterThan(0);
    expect(fontRequests.some(url => url.includes('archivo'))).toBe(true);
    expect(fontRequests.some(url => url.includes('jetbrains'))).toBe(true);
    expect(serviceRequests).toEqual([]);
    for (const url of fontRequests) expect(new URL(url).origin).toBe(new URL(page.url()).origin);
    page.off('request', listener);
  }
});

test('S-04 content and navigation work without JavaScript', async ({ browser }) => {
  const enabled = await browser.newContext();
  const disabled = await browser.newContext({ javaScriptEnabled: false });
  const a = await enabled.newPage(); const b = await disabled.newPage();
  for (const route of routes) {
    const url = new URL(route, base).href;
    await a.goto(url); await b.goto(url);
    await expect(b.locator('main')).toBeVisible();
    await expect(b.locator('[data-js-only]:visible')).toHaveCount(0);
    const content = (page: typeof a) => page.locator('main').evaluate(el => { const nodes = Array.from(el.querySelectorAll<HTMLElement>('[data-js-only]')); const styles = nodes.map(node => [node.style.getPropertyValue('display'), node.style.getPropertyPriority('display')]); try { nodes.forEach(node => node.style.setProperty('display', 'none', 'important')); return (el as HTMLElement).innerText; } finally { nodes.forEach((node, index) => { const [value, priority] = styles[index]; if (value) node.style.setProperty('display', value, priority); else node.style.removeProperty('display'); }); } });
    expect(await content(b)).toBe(await content(a));
    expect(await b.locator('a[href]').evaluateAll(els => els.map(el => el.getAttribute('href')))).toEqual(await a.locator('a[href]').evaluateAll(els => els.map(el => el.getAttribute('href'))));
  }
  await enabled.close(); await disabled.close();
});

test('S-05 accessibility and keyboard focus', async ({ page }) => {
  for (const route of routes) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
    const expected = await page.locator('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]').evaluateAll(els => els.filter(el => (el as HTMLElement).offsetParent !== null).map(el => el.outerHTML));
    const visited: string[] = [];
    for (let i = 0; i < expected.length; i++) {
      await page.keyboard.press('Tab');
      const focused = page.locator(':focus');
      await expect(focused).toHaveCSS('outline-width', '2px');
      await expect(focused).toHaveCSS('outline-color', 'rgb(163, 74, 38)');
      visited.push(await focused.evaluate(el => el.outerHTML));
    }
    expect(visited).toEqual(expected);
  }
});
