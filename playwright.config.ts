import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests', testMatch: '**/*.spec.ts', workers: 1, timeout: 120000, reporter: [['list'], ['json', { outputFile: '.verify-state/playwright.json' }]], use: { baseURL: `http://127.0.0.1:${Number(process.env.VERIFY_PORT_BASE || 18788)}` } });
