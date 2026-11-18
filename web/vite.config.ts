import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Heavy, rarely used, hash-named files: fetched on first use, then kept by the runtime cache (not precached). */
const HEAVY_ASSET = /\/assets\/(?:pdfText\.worker|zxing_reader)-[\w-]+\.(?:js|wasm)$/;

// `worker.format: 'es'`: the PDF worker (pdf.js) is a module worker, loaded on demand.
export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      // The prompt flow needs a registration that goes through a Trusted Types policy: see src/pwa/register.ts.
      injectRegister: false,
      registerType: 'prompt',
      manifest: {
        id: '/',
        name: 'IBD Journal',
        short_name: 'IBD Journal',
        description: 'Private journal for inflammatory bowel disease: stools, symptoms, treatments, labs. Data stays on your device.',
        lang: 'en',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        categories: ['health', 'medical', 'lifestyle'],
        theme_color: '#0B6E63',
        background_color: '#F7FAF8',
        icons: [
          { src: '/icons/app-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/app-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/app-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/app-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only: HTML, JS/CSS chunks (route and language chunks included), Bristol icons.
        globPatterns: ['**/*.{html,js,css,svg,webmanifest}', 'icons/app-192.png', 'icons/apple-touch-icon.png'],
        globIgnores: ['**/pdfText.worker-*.js', '**/zxing_reader-*', '**/*.wasm'],
        runtimeCaching: [
          {
            // A RegExp, not a function: the config is serialized into sw.js, which would lose HEAVY_ASSET.
            urlPattern: HEAVY_ASSET,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ibdj-heavy-assets',
              cacheableResponse: { statuses: [200] },
              // Names are content-hashed: an old release's files only linger until evicted.
              expiration: { maxEntries: 6 },
            },
          },
        ],
        // One self-contained sw.js: the generated loader would call importScripts() with a plain string,
        // which `require-trusted-types-for 'script'` (applied to the worker by the CSP header) rejects.
        inlineWorkboxRuntime: true,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // A new worker waits for the page's "Update" (message SKIP_WAITING), but a first install takes control at once.
        clientsClaim: true,
        skipWaiting: false,
      },
    }),
  ],
  build: { target: 'es2022' },
  worker: { format: 'es' },
});
