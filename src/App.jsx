import React, { useState, useEffect } from 'react';
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
import TopBar from './components/TopBar';
import BottomNav from './components/BottomNav';

// Composant pour protéger les routes
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA Install Prompt Listener
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      window.deferredPrompt = e;
      // Dispatch custom event so other components know it's available
      window.dispatchEvent(new Event('app-installable'));
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);
  
  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner"></div>
      </div>
    );
  }
  
  if (!user) {
    // Save the current location so we can redirect back after login
    const currentPath = window.location.pathname;
    return <Navigate to={`/login?redirect=${encodeURIComponent(currentPath)}`} replace />;
  }

  // If offline and trying to access pages other than Library or Reader, show OfflineStatus
  // Wait, offline fallback can just be an overlay or redirect. For now, let's just render the children.
  // The mockup shows an offline screen with "Go to Library". We could route to /offline if offline and not in library/reader.
  
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

// Layout sans BottomNav (pour Reader ou Offline)
function SimpleLayout({ children }) {
  return (
    <div className="page" style={{ paddingBottom: 0 }}>
      <TopBar />
      <main className="container">
        {children}
      </main>
    </div>
  );
}


function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      document.documentElement.setAttribute('data-theme', 'dark'); // default
    }
  }, []);

  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}

export default App;
