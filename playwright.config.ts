import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'packages/viewer/e2e',
  globalSetup: './packages/viewer/e2e/global-setup.ts',
  timeout: 60_000,
  fullyParallel: true,
  reporter: [['list']],
  use: { viewport: { width: 1280, height: 800 } },
});
