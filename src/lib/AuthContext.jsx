/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext({});

// ─── LocalStorage session cache keys ────────────────────────
const CACHED_USER_KEY = 'bread_cached_user';
const CACHED_PROFILE_KEY = 'bread_cached_profile';

function getCachedUser() {
    try {
        const raw = localStorage.getItem(CACHED_USER_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function getCachedProfile() {
    try {
        const raw = localStorage.getItem(CACHED_PROFILE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function cacheUserSession(user, profile) {
    try {
        if (user) {
            localStorage.setItem(CACHED_USER_KEY, JSON.stringify({
                id: user.id,
                email: user.email,
                // Only cache essential fields — not tokens
            }));
        } else {
            localStorage.removeItem(CACHED_USER_KEY);
        }
        if (profile) {
            localStorage.setItem(CACHED_PROFILE_KEY, JSON.stringify(profile));
        } else {
            localStorage.removeItem(CACHED_PROFILE_KEY);
        }
    } catch { /* quota exceeded — ignore */ }
}

function clearCachedSession() {
    localStorage.removeItem(CACHED_USER_KEY);
    localStorage.removeItem(CACHED_PROFILE_KEY);
}

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId) => {
        if (!userId) { setProfile(null); return null; }
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, email, role, created_at')
                .eq('id', userId)
                .single();
            if (error) { setProfile(null); return null; }
            setProfile(data);
            return data;
        } catch {
            // Network error — keep cached profile if available
            return null;
        }
    };

    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                // ── Offline-first: use cached session immediately ──
                if (!navigator.onLine) {
                    const cachedUser = getCachedUser();
                    const cachedProfile = getCachedProfile();
                    if (cachedUser) {
                        if (mounted) {
                            setUser(cachedUser);
                            setProfile(cachedProfile);
                            setLoading(false);
                        }
                        return; // Don't try network calls when offline
                    }
                    // No cached session and offline → loading done, no user
                    if (mounted) setLoading(false);
                    return;
                }

                // ── Online: try Supabase auth with a quick pre-fill from cache ──
                const cachedUser = getCachedUser();
                const cachedProfile = getCachedProfile();
                if (cachedUser && mounted) {
                    // Pre-fill UI immediately while Supabase verifies
                    setUser(cachedUser);
                    setProfile(cachedProfile);
                }

                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error('[Auth] init error:', error);
                    // If we have a cached user, keep using it
                    if (!cachedUser && mounted) {
                        setUser(null);
                        setProfile(null);
                    }
                } else if (session?.user) {
                    if (mounted) setUser(session.user);
                    const prof = await fetchProfile(session.user.id);
                    // Cache the verified session
                    cacheUserSession(session.user, prof);
                } else {
                    // No session from Supabase — clear cache
                    if (mounted) {
                        setUser(null);
                        setProfile(null);
                    }
                    clearCachedSession();
                }
            } catch (err) {
                console.error('[Auth] init fatal error:', err);
                // On network failure, keep cached user if available
                const cachedUser = getCachedUser();
                if (cachedUser && mounted) {
                    setUser(cachedUser);
                    setProfile(getCachedProfile());
                }
            } finally {
                if (mounted) setLoading(false);
            }
        }

        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!mounted) return;

            if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
                setUser(null);
                setProfile(null);
                clearCachedSession();
                return;
            }

            const currentUser = session?.user ?? null;
            setUser(currentUser);
            
            if (currentUser) {
                fetchProfile(currentUser.id).then(prof => {
                    cacheUserSession(currentUser, prof);
                });
            } else {
                setProfile(null);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signIn = async (email, password) => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (data?.user && !error) {
            const prof = await fetchProfile(data.user.id);
            cacheUserSession(data.user, prof);
        }
        return { data, error };
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) {
            setProfile(null);
            clearCachedSession();
        }
        return { error };
    };

    return (
        <AuthContext.Provider value={{
            user, profile, loading,
            signIn, signOut,
            refreshProfile: () => user ? fetchProfile(user.id) : Promise.resolve(null),
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
}
