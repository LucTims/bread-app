import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/AuthContext';
import Login from './pages/Login';
import Home from './pages/Home';
import Library from './pages/Library';
import Search from './pages/Search';
import Notifications from './pages/Notifications';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Reader from './pages/Reader';
import OfflineStatus from './pages/OfflineStatus';
import Admin from './pages/Admin';
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';

// Composant pour protéger les routes utilisateurs connectés
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // When offline, let pages through — they handle their own offline data from IndexedDB
  if (isOffline) {
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

// Layout principal avec Header et BottomNav
function MainLayout({ children }) {
  return (
    <div className="page">
      <TopBar />
      <main className="container">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}

// Contenu de l'application nécessitant l'accès au contexte d'authentification
function AppContent() {
  const { user } = useAuth();

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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        <Route path="/" element={
          <ProtectedRoute>
            <MainLayout><Home /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/library" element={
          <ProtectedRoute>
            <MainLayout><Library /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/search" element={
          <ProtectedRoute>
            <MainLayout><Search /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/notifications" element={
          <ProtectedRoute>
            <MainLayout><Notifications /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/profile" element={
          <ProtectedRoute>
            <MainLayout><Profile /></MainLayout>
          </ProtectedRoute>
        } />
        
        <Route path="/settings" element={
          <ProtectedRoute>
            <MainLayout><Settings /></MainLayout>
          </ProtectedRoute>
        } />

        <Route path="/offline" element={
          <ProtectedRoute>
            <OfflineStatus />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <AdminRoute>
            <MainLayout><Admin /></MainLayout>
          </AdminRoute>
        } />

        <Route path="/reader/:bookId" element={
          <ProtectedRoute>
            <Reader />
          </ProtectedRoute>
        } />

        {/* Nouvelle route demandée par BoomBooks pour la redirection automatique */}
        <Route path="/read/:bookId" element={
          <ProtectedRoute>
            <Reader />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

function App({ onReady }) {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark'); // default
    }

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
