import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { donnees } from './scripts/lib/vite-donnees';

const racine = fileURLToPath(new URL('.', import.meta.url));

// GitHub Pages sert l'app sous /<dépôt>/ : BASE=/gamelle/ au build de déploiement.
export default defineConfig({
  base: process.env.BASE ?? '/',
  plugins: [
    donnees(racine),
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Gamelle',
        short_name: 'Gamelle',
        description: 'Menu de la semaine léger, pas cher et en batch, avec de vraies recettes vérifiées.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F4EEE1',
        theme_color: '#F4EEE1',
        categories: ['food', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // tout le nécessaire pour cuisiner et faire les courses sans réseau
        globPatterns: ['**/*.{js,css,html,svg,woff2,webmanifest}', 'icons/{apple-touch-icon,icon-192,icon-512}.png'],
        navigateFallback: 'index.html',
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  worker: {
    format: 'es',
    plugins: () => [donnees(racine)],
  },
});
