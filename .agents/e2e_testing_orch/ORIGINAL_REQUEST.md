# Original User Request

## 2026-08-07T17:15:00Z

Renforcer la fiabilité hors-ligne de l'application BoomRead (une PWA React/Vite de lecture d'ebooks) pour qu'elle s'ouvre et fonctionne **toujours**, même sans aucune connexion réseau, ou quand les données mobiles sont activées sans connectivité réelle. L'objectif est une expérience "offline-first" où tout ce qui peut fonctionner localement fonctionne immédiatement, avec synchronisation intelligente en arrière-plan dès que le réseau revient.

Working directory: c:\Users\helpdesk\Desktop\bread-app
Integrity mode: development

## Requirements

### R1. Guaranteed App Opening — Offline-First Shell
The app must always open and display usable content regardless of network state. The app shell, all UI routes, and the library view must render from cache first, every time.

### R2. Real Connectivity Detection
Replace unreliable `navigator.onLine` check with a true connectivity detection system combining `navigator.onLine` with actual reachability probing. Accurately distinguish between: (a) truly online, (b) truly offline, and (c) phantom connectivity.

### R3. Offline-First Data Loading
All data-fetching operations (book list, metadata, covers, reading progress, user profile) must follow an offline-first pattern: load from local cache immediately, then update from network in the background.

### R4. Robust Offline Reading Experience
All locally downloaded books must be fully readable offline, including: PDF rendering, page navigation, reading progress tracking, and native browser TTS.

### R5. Intelligent Background Sync
When real connectivity is restored, sync all queued data (reading statistics, progress updates) from `sync_queue` IndexedDB store to server without blocking UI.
