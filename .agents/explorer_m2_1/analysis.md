# Milestone 2 (R1): Guaranteed App Opening — Offline-First Shell Detailed Analysis

## Executive Summary
This document presents the detailed technical analysis of the Service Worker and Workbox configuration in `vite.config.js` and PWA registration logic in `src/main.jsx` for **Milestone 2: Guaranteed App Opening — Offline-First Shell (Requirement R1)**.

---

## 1. VitePWA Plugin Setup in `vite.config.js`

### 1.1 Plugin Integration
- **Package**: `vite-plugin-pwa` version `^1.3.0` (declared in `package.json:32`).
- **Configuration Location**: `vite.config.js` (lines 9–112).
- **Generator Mode**: Uses default `generateSW` mode. Workbox generates the service worker bundle `dist/sw.js` at build time.
- **Max File Size Limit**: `maximumFileSizeToCacheInBytes: 5 * 1024 * 1024` (5MB, line 47), ensuring large React/PDF bundles are not skipped during precaching.
- **Custom Worker Script Import**: `importScripts: ['sw-push.js']` (line 45), importing `public/sw-push.js` into the generated service worker to handle background web push notifications (`push` and `notificationclick` events).

### 1.2 Web App Manifest
Configured in `vite.config.js` (lines 12–40):
- **Name / Short Name**: `BRead – Liseuse BoomBooks` / `BRead`.
- **Start URL / Scope**: `'/'` / `'/'`.
- **Display Mode**: `'standalone'` (full native app container).
- **Theme Color / Background Color**: `#FFD60A` / `#0B0F14`.
- **Icons**:
  - `192x192` (`/icon-192.png`)
  - `512x512` (`/icon-512.png`)
  - `512x512 maskable` (`/icon-512.png`)

---

## 2. Precache Configuration Analysis

### 2.1 Asset Matching (`globPatterns` & `includeAssets`)
- **`globPatterns`** (line 42): `['**/*.{js,mjs,css,html,ico,png,svg,woff,woff2,webmanifest}']`
  - **Included Extensions**: `.js`, `.mjs`, `.css`, `.html`, `.ico`, `.png`, `.svg`, `.woff`, `.woff2`, `.webmanifest`.
  - **Observation / Defect**: Extensions `.jpg`, `.jpeg`, `.webp`, and `.gif` are **omitted** from `globPatterns`.
  - **Impact**: Static JPEG images located in `public/` (such as `/logo.jpg`, referenced in `index.html:5-6` as `<link rel="icon" type="image/jpeg" href="/logo.jpg" />`) are **NOT precached** automatically by Workbox during service worker installation.

- **`includeAssets`** (line 11): `['favicon.svg', 'icons.svg', 'icon-192.png', 'icon-512.png']`
  - **Observation / Defect**: Explicitly includes SVG and PNG icons, but omits `logo.jpg`.

### 2.2 Navigation Fallback (`navigateFallback`)
- **`navigateFallback`** (line 43): `'/index.html'`
  - **Function**: All navigation requests (e.g. `/`, `/library`, `/reader/123`, `/profile`, `/settings`) that hit the Service Worker while offline resolve to the precached `/index.html` Single Page Application shell.
- **`navigateFallbackDenylist`** (line 44): `[/^\/api/]`
  - **Function**: Excludes backend API routes starting with `/api/` from receiving HTML navigation fallbacks.

---

## 3. Runtime Caching Rules Verification

| Category | URL Pattern | Strategy / Handler | Configured Timeout / Options | Requirement Compliance |
|---|---|---|---|---|
| **Google Fonts Stylesheets** | `^https:\/\/fonts\.googleapis\.com\/.*/i` | `CacheFirst` | `cacheName: 'google-fonts-cache'`, maxAge 1 yr | ✅ Compliant |
| **Google Fonts WOFF2** | `^https:\/\/fonts\.gstatic\.com\/.*/i` | `CacheFirst` | `cacheName: 'gstatic-fonts-cache'`, maxAge 1 yr, statuses `[0, 200]` | ✅ Compliant |
| **Material Symbols Font** | `^https:\/\/fonts\.googleapis\.com\/css2\?family=Material\+Symbols.*/i` | `CacheFirst` | `cacheName: 'material-icons-cache'`, maxAge 1 yr | ✅ Compliant |
| **Supabase Book Covers** | `^https:\/\/ezmchxokfeybpccmkhyx\.supabase\.co\/storage\/.*\.(jpg\|jpeg\|png\|gif\|webp\|svg)` | `CacheFirst` | `cacheName: 'supabase-covers-cache'`, maxEntries 200, maxAge 30 days | ✅ Compliant |
| **Supabase Other Storage** | `^https:\/\/ezmchxokfeybpccmkhyx\.supabase\.co\/storage\/.*/i` | `NetworkFirst` | `cacheName: 'supabase-storage-cache'`, `networkTimeoutSeconds: 10` | ⚠️ Non-compliant timeout (10s) |
| **Supabase API (auth/rest)** | `^https:\/\/ezmchxokfeybpccmkhyx\.supabase\.co\/(auth\|rest)\/.*/i` | `NetworkFirst` | `cacheName: 'supabase-api-cache'`, `networkTimeoutSeconds: 5` | ❌ Non-compliant timeout (5s > 3s requirement) |

### 3.1 Detailed Analysis of API Timeout Non-Compliance
Requirement R1 explicitly dictates: **NetworkFirst with short timeout (<= 3s) for API calls**.
- **Current setting in `vite.config.js:97`**: `networkTimeoutSeconds: 5`.
- **Finding**: On poor or phantom connections, a fetch to Supabase Auth (`/auth/v1/...`) or REST API (`/rest/v1/...`) waits up to **5 seconds** before falling back to the cached response. This causes visible UI lag and violates the strict 3-second limit.
- **Required Fix**: Change `networkTimeoutSeconds: 5` to `networkTimeoutSeconds: 3` (or `2.5`).

---

## 4. Service Worker Registration Mode Verification

- **PWA Config Mode** (`vite.config.js:10`): `registerType: 'autoUpdate'`.
- **Client Registration Code** (`src/main.jsx:8-16`):
  ```javascript
  const updateSW = registerSW({
    onNeedRefresh() {
      updateSW(true); // Force SW to skipWaiting and activate immediately
    },
    onOfflineReady() {
      console.log('✅ BoomRead est prêt pour une utilisation hors-ligne !');
    },
  });
  ```
- **Verification**: `autoUpdate` is fully active. When a new build of the SW is detected, `onNeedRefresh` calls `updateSW(true)` automatically without requiring user prompt interaction, guaranteeing instant background updates and continuous offline shell availability.

---

## 5. Summary of Identified Defects & Recommendations

1. **Defect 1 (API Timeout Exceeds Requirement)**: `vite.config.js:97` sets `networkTimeoutSeconds: 5` for `supabase-api-cache`. Change to `networkTimeoutSeconds: 3`.
2. **Defect 2 (Missing JPEG precaching)**: `logo.jpg` used in `index.html:5-6` is not included in `globPatterns` (lacks `jpg`/`jpeg`) or `includeAssets`. Add `jpg`/`jpeg`/`webp` to `globPatterns` or add `'logo.jpg'` to `includeAssets`.
3. **Storage Assets Timeout**: `supabase-storage-cache` has `networkTimeoutSeconds: 10` (line 87). Consider lowering to `3s` for consistency with offline-first responsiveness.
