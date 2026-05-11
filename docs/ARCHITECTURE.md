# BREAD APP - Architecture & Contexte

## Origine du Projet
"Bread" est une application de lecture autonome (Liseuse) pour les clients de "BoomBooks" (boombooks.shop). 
L'objectif est d'imiter des services comme **Scribd** ou **Kindle** : permettre aux utilisateurs ayant acheté un livre sur BoomBooks de le lire **hors-ligne**, tout en **empêchant formellement le partage du fichier PDF brut** (DRM strict).

## Choix Technologique : Progressive Web App (PWA)
- **Framework :** React + Vite.js (scaffoldé via `create-vite`).
- **Base de données :** Supabase (Connectée au même projet que BoomBooks pour partager l'authentification et les achats).
- **Design :** Type liseuse, sombre/clair, épuré, en reprenant la typographie et les couleurs primaires de BoomBooks.
- **Stockage hors-ligne :** `localforage` (qui utilise IndexedDB).
- **Lecteur PDF :** `react-pdf` (Rendu via des balises `<canvas>`).

## Le Mécanisme Anti-Partage (DRM Local)
Pour qu'un utilisateur ne puisse pas envoyer le PDF à un ami via WhatsApp :
1. L'application récupère le PDF depuis `Supabase Storage`.
2. Le PDF est converti en "Blob" binaire et enregistré dans la base de données interne du navigateur (IndexedDB) via `localforage`.
3. Le fichier n'est **jamais** téléchargé dans le dossier "Téléchargements" du téléphone ou de l'ordinateur.
4. Lors de la lecture, `react-pdf` dessine le Blob directement sur un canvas HTML, page par page. Il n'y a pas d'`iframe` ni d'URL source visible.

## Prochaines Étapes de Développement (Pour l'assistant IA de la nouvelle fenêtre)
1. **Initialisation :** Installer TailwindCSS (ou du CSS pur similaire à BoomBooks), `@supabase/supabase-js`, `vite-plugin-pwa`, `localforage`, `react-pdf`, `react-router-dom`.
2. **Configuration Supabase :** Créer un fichier `.env` avec les identifiants de BoomBooks.
3. **Authentification :** Créer une page de Login pour que les utilisateurs de BoomBooks puissent se connecter.
4. **Synchronisation :** Afficher la bibliothèque des livres achetés par l'utilisateur connecté.
5. **Téléchargement Hors-Ligne :** Implémenter le téléchargement du PDF dans IndexedDB avec un indicateur de progression.
6. **Le Lecteur (Reader) :** Construire l'interface de lecture PWA (plein écran, sans distraction, mode sombre/clair).
