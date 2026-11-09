import { defineConfig } from '@playwright/test';

/**
 * Tests d'interface au format iPhone 15 (393 × 852).
 * WebKit n'est pas installé dans l'environnement de développement cloud : on teste avec Chromium
 * en émulation mobile (toucher, viewport). `npm run e2e` construit l'app puis lance les tests.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    viewport: { width: 393, height: 852 },
    isMobile: true,
    hasTouch: true,
    locale: 'fr-FR',
    deviceScaleFactor: 1,
    serviceWorkers: 'block',
  },
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
