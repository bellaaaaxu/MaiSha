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
          { src: 'icon-maskable.svg', sizes: 'any',      type: 'image/svg+xml', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api',
              networkTimeoutSeconds: 3
            }
          }
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
