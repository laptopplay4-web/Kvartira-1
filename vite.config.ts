/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

/**
 * Content Security Policy for the production bundle.
 *
 * The backend origin is only known at build time (`VITE_API_URL`), and the
 * theme bootstrap in index.html is inline, so both are resolved here instead of
 * being hardcoded in the HTML. Inline scripts are allowed by hash, not by
 * `unsafe-inline` — adding a second inline script without updating this plugin
 * will be blocked, which is the intended failure mode.
 *
 * `frame-ancestors` and `X-Frame-Options` are ignored in a <meta> CSP; they
 * must come from the web server (see deploy/security-headers.conf).
 */
function cspPlugin(apiUrl: string): Plugin {
  return {
    name: 'kvartira-csp',
    apply: 'build',
    // `post` so the hashes cover whatever other plugins injected (PWA, etc.).
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const api = apiUrl.replace(/\/$/, '');
        const backend = api ? ` ${api}` : '';
        const socket = api ? ` ${api.replace(/^http/, 'ws')}` : '';

        const inlineHashes = [
          ...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g),
        ]
          .map(([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`)
          .join(' ');

        const csp = [
          "default-src 'self'",
          `script-src 'self' ${inlineHashes}`.trim(),
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com data:",
          `img-src 'self' data: blob:${backend}`,
          `media-src 'self' data: blob:${backend}`,
          `connect-src 'self'${backend}${socket}`,
          "worker-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; ');

        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: { 'http-equiv': 'Content-Security-Policy', content: csp },
              injectTo: 'head-prepend',
            },
          ],
        };
      },
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    server: {
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    plugins: [
      react(),
      tailwindcss(),
      cspPlugin(env.VITE_API_URL ?? ''),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['assets/logo.png'],
        manifest: {
          name: 'Квартира',
          short_name: 'Квартира',
          description: 'Школа музыки и вокала',
          theme_color: '#00796b',
          background_color: '#0c0b10',
          display: 'standalone',
          orientation: 'portrait',
          lang: 'ru',
          icons: [
            { src: '/assets/logo.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            { src: '/assets/logo.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          importScripts: ['push-sw.js'],
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
    },
  };
});
