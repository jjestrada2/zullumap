import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'packages',
  testMatch: '*/e2e/**/*.spec.ts',
  globalSetup: './packages/cli/e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { viewport: { width: 1280, height: 800 } },
});
