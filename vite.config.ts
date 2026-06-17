import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), VitePWA({
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
      globPatterns: ['**/*.{js,css,html,svg,webp,woff2}'],
      navigateFallback: '/index.html',
      navigateFallbackDenylist: [/^\/api/],
      runtimeCaching: [
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
  }), cloudflare()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './tests/setup.ts'
  }
});