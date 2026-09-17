import { defineConfig } from '@playwright/test';

const PORT = 3210;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/visual',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: {
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.01,
    },
  },
  snapshotPathTemplate: '{testDir}/__snapshots__/{testFilePath}/{projectName}/{arg}{ext}',
  use: {
    baseURL,
    colorScheme: 'light',
    locale: 'pt-BR',
    timezoneId: 'America/Manaus',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      PORT: String(PORT),
      ENABLE_PUBLIC_DEMAND_INTAKE: 'true',
      ENABLE_PUBLIC_REGISTRATION: 'false',
      INTERNAL_PILOT_MODE: 'false',
      JWT_SECRET: 'visual-qa-local-only-secret-not-for-production',
      INTELLIGENCE_AUTO_REFRESH: 'false',
    },
  },
  projects: [
    { name: 'mobile-375x667', use: { viewport: { width: 375, height: 667 } } },
    { name: 'tablet-768x968', use: { viewport: { width: 768, height: 968 } } },
    { name: 'desktop-1536x864', use: { viewport: { width: 1536, height: 864 } } },
  ],
});
