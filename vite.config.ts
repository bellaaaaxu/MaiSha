import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon.svg', 'icon-maskable.svg'],
      manifest: {
        name: '买啥 MaiSha',
        short_name: '买啥',
        description: '共享购物清单 · 去超市不漏买',
        theme_color: '#07c160',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        lang: 'zh-CN',
        icons: [
          { src: 'icon.svg',          sizes: 'any',      type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-maskable.svg', sizes: 'any',      type: 'image/svg+xml', purpose: 'maskable' },
          { src: 'icon-192.png',      sizes: '192x192',  type: 'image/png' },
          { src: 'icon-512.png',      sizes: '512x512',  type: 'image/png' }
        ]
      },
      workbox: {
        // Note: png deliberately excluded from precache. The onboarding washi
        // decorations in /decorations/ are large (3-5 MB) and exceed Workbox's
        // default 2 MiB precache limit. They're cached on-demand via the
        // runtimeCaching rule below — first onboarding visit fetches them
        // over the network; subsequent visits read from cache.
        // TODO: compress these PNGs (target <300 KB each) so they can move
        // back into precache for true offline-first behavior.
        globPatterns: ['**/*.{js,css,html,svg,webp,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          // Onboarding washi decorations — cache-first, served from public/decorations/
          {
            urlPattern: /\/decorations\/.*\.png$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'onboarding-decorations',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year (assets are immutable)
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Specific: custom icons — cache-first for offline access
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/v1\/object\/public\/custom-icons\/.*/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'custom-icons',
              expiration: {
                maxEntries: 200,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // General: Supabase API — network-first
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 3
            }
          },
        ]
      }
    })
  ],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts'
  }
});
