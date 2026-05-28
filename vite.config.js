import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'BRead – Liseuse BoomBooks',
        short_name: 'BRead',
        description: 'Lisez vos livres BoomBooks partout, même hors-ligne.',
        theme_color: '#FFD60A',
        background_color: '#0B0F14',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,mjs,css,html,ico,png,svg,woff,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        importScripts: ['sw-push.js'],
        // Increase precache size limits for larger bundles
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB
        runtimeCaching: [
          // ── Google Fonts stylesheets ──
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }
            }
          },
          // ── Google Fonts WOFF2 files ──
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ── Supabase Storage: book covers (images) ──
          // CacheFirst so covers are available offline after first load
          {
            urlPattern: /^https:\/\/ezmchxokfeybpccmkhyx\.supabase\.co\/storage\/.*\.(jpg|jpeg|png|gif|webp|svg)/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'supabase-covers-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // ── Supabase Storage: other assets (PDFs etc) ── NetworkFirst for freshness
          {
            urlPattern: /^https:\/\/ezmchxokfeybpccmkhyx\.supabase\.co\/storage\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-storage-cache',
              expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
              networkTimeoutSeconds: 10
            }
          },
          // ── Supabase API (auth, REST) ── NetworkFirst with fast fallback
          {
            urlPattern: /^https:\/\/ezmchxokfeybpccmkhyx\.supabase\.co\/(auth|rest)\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'supabase-api-cache',
              expiration: { maxEntries: 30, maxAgeSeconds: 24 * 60 * 60 },
              networkTimeoutSeconds: 5
            }
          },
          // ── Google Material Symbols (icon font) ──
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'material-icons-cache',
              expiration: { maxEntries: 5, maxAgeSeconds: 365 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
})


