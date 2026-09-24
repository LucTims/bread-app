import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { flushSyncQueue } from './lib/offlineStore';
import { useBackgroundSync } from './lib/useBackgroundSync';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Landing from './pages/Landing';
import Library from './pages/Library';
import Search from './pages/Search';
import Chat from './pages/Chat';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Reader from './pages/Reader';
import OfflineStatus from './pages/OfflineStatus';
import Admin from './pages/Admin';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';
import { ChatProvider } from './lib/ChatContext';
import ChatIndex from './pages/ChatIndex';
import useOnlineStatus from './lib/useOnlineStatus';
import { initDeviceFileHandler } from './lib/deviceFileHandler';
import AIChat from './pages/AIChat';
import { AnimatePresence, motion } from 'framer-motion';

// Composant pour protéger les routes utilisateurs connectés
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const { isOffline, isOnline } = useOnlineStatus();
  
  // When offline (or phantom offline), let pages through — they handle their own offline data from IndexedDB
  if (isOffline || !isOnline) {
    return children;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!user) {
    const currentPath = window.location.pathname;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }
  
  return children;
}

// Composant pour protéger les routes administrateur
function AdminRoute({ children }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user || profile?.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Transition fluide entre pages — comportement d'application native
const pageVariants = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] } },
};

function PageTransition({ children }) {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{ flex: 1, minHeight: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

// Layout principal avec Header et BottomNav
function MainLayout({ children, hideTopBar, minimalTopBar }) {
  return (
    <div className="page">
      {!hideTopBar && <TopBar minimal={minimalTopBar} />}
      <main className="container" style={hideTopBar ? { paddingTop: 'var(--space-4)' } : undefined}>
        <PageTransition>{children}</PageTransition>
      </main>
      <BottomNav />
    </div>
  );
}

// Contenu de l'application nécessitant l'accès au contexte d'authentification
function AppContent() {
  const { user } = useAuth();
  
  // Top-level intelligent background sync manager
  useBackgroundSync();

  // 1. Écouter les installations physiques même hors connexion (ex: avant login)
  useEffect(() => {
    const handleAppInstalledGlobal = () => {
      localStorage.setItem('pwa_just_installed', 'true');
      console.log('✅ PWA just installed (saved to localStorage)');
    };
    window.addEventListener('appinstalled', handleAppInstalledGlobal);
    return () => {
      window.removeEventListener('appinstalled', handleAppInstalledGlobal);
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    // 2. Logger les lancements PWA (standalone)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      import('./lib/pwaInstallLogger').then(({ logAppInstall }) => {
        logAppInstall(user.id, user.email);
      });
    }

    // 3. Logger les installations en attente d'enregistrement (ex: faites avant la connexion)
    const justInstalled = localStorage.getItem('pwa_just_installed');
    if (justInstalled === 'true') {
      import('./lib/pwaInstallLogger').then(({ logAppInstall }) => {
        logAppInstall(user.id, user.email).then(() => {
          localStorage.removeItem('pwa_just_installed');
        });
      });
    }

    // 4. Écouter les installations physiques réussies pendant que l'utilisateur est connecté
    const handleAppInstalled = () => {
      import('./lib/pwaInstallLogger').then(({ logAppInstall }) => {
        logAppInstall(user.id, user.email);
      });
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // 5. Auto-subscribe to push if permission was previously granted
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      import('./lib/pushManager').then(({ subscribeToPush }) => {
        // Wrap in timeout to avoid hanging if SW isn't ready
        const timeout = setTimeout(() => {
          console.warn('[Push] Service worker ready timed out');
        }, 10000);
        subscribeToPush(user.id).finally(() => clearTimeout(timeout));
      });
    }

    return () => {
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, [user]);

  // 6. Écouter les ouvertures directes de fichiers du téléphone (Intent Android & Drag-Drop)
  useEffect(() => {
    initDeviceFileHandler((bookId) => {
      window.location.href = `/read/${bookId}`;
    });
  }, []);

  return (
    <BrowserRouter>
      <ChatProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
        
        {/* L'app démarre directement — pas de page marketing */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        
        {/* Routes ouvertes en Mode Hybride (locaux disponibles pour tous, cloud synchronisé si connecté) */}
        <Route path="/home" element={
          <MainLayout hideTopBar><Home /></MainLayout>
        } />
        
        <Route path="/library" element={
          <MainLayout hideTopBar><Library /></MainLayout>
        } />
        
        <Route path="/search" element={
          <MainLayout hideTopBar><Search /></MainLayout>
        } />

        {/* Routes nécessitant un compte BoomBooks */}
        <Route path="/chat" element={
          <ProtectedRoute>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)', overflow: 'hidden' }}>
              <ChatIndex />
              <BottomNav />
            </div>
          </ProtectedRoute>
        } />

        <Route path="/chat/community" element={
          <ProtectedRoute>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)', overflow: 'hidden' }}>
              <Chat />
            </div>
          </ProtectedRoute>
        } />

        <Route path="/chat/ai" element={
          <ProtectedRoute>
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--color-bg)', overflow: 'hidden' }}>
              <AIChat />
            </div>
          </ProtectedRoute>
        } />
        
        <Route path="/notifications" element={
          <ProtectedRoute>
            <MainLayout hideTopBar><Notifications /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <MainLayout minimalTopBar><Profile /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <MainLayout hideTopBar><Settings /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/offline" element={
          <OfflineStatus />
        } />

        <Route path="/admin" element={
          <AdminRoute>
            <MainLayout><Admin /></MainLayout>
          </AdminRoute>
        } />

        {/* Lecture directe : accessible à tous pour les fichiers locaux, protégée par droits pour les livres BoomBooks */}
        <Route path="/reader/:bookId" element={<Reader />} />
        <Route path="/read/:bookId" element={<Reader />} />
      </Routes>
      </ChatProvider>
    </BrowserRouter>
  );
}

function App({ onReady }) {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Dismiss splash screen after first render
    if (onReady) onReady();
  }, [onReady]);

  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
