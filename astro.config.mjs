// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { validatePosts } from './src/lib/validate-posts.mjs';
import { calloutPlugin } from './src/lib/callouts.mjs';
import { cp } from 'node:fs/promises';
const cacheDir = process.env.RESUME_TEST_EMPTY === '1' ? './.astro-cache/empty' : process.env.RESUME_TEST_FIXTURES === '1' ? './.astro-cache/fixtures' : './.astro-cache/production';

export default defineConfig({
  site: 'https://www.tylerevans.co',
  outDir: process.env.RESUME_TEST_EMPTY === '1' ? './empty-dist' : process.env.RESUME_TEST_FIXTURES === '1' ? './fixture-dist' : './dist',
  cacheDir,
  markdown: { remarkPlugins: [calloutPlugin], shikiConfig: { theme: {
    name: 'mesa', type: 'dark', colors: { 'editor.background': '#1E2320', 'editor.foreground': '#E2DDCF' },
    tokenColors: [
      { scope: ['keyword', 'storage', 'comment'], settings: { foreground: '#D99A6C' } },
      { scope: ['string', 'entity.name.function', 'support.function', 'variable.function'], settings: { foreground: '#A9BC94' } },
    ],
  } } },
  integrations: [{ name: 'validate-posts', hooks: { 'astro:config:setup': async () => { await validatePosts(); }, 'astro:build:done': async ({ dir }) => { if (process.env.RESUME_TEST_FIXTURES === '1' && process.env.RESUME_TEST_EMPTY !== '1') await cp(new URL('./tests/fixtures/assets/', import.meta.url), new URL('./test-media/', dir), { recursive: true }); } } }, mdx(), sitemap()],
});
