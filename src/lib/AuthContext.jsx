import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchProfile = async (userId) => {
        if (!userId) { setProfile(null); return null; }
        const { data, error } = await supabase
            .from('profiles')
            .select('id, email, role, created_at')
            .eq('id', userId)
            .single();
        if (error) { setProfile(null); return null; }
        setProfile(data);
        return data;
    };

    useEffect(() => {
        let mounted = true;

        async function init() {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) {
                    console.error('[Auth] init error:', error);
                } else if (session?.user) {
                    setUser(session.user);
                    await fetchProfile(session.user.id);
                }
            } catch (err) {
                console.error('[Auth] init fatal error:', err);
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
                return;
            }

            const currentUser = session?.user ?? null;
            setUser(currentUser);
            
            if (currentUser) {
                fetchProfile(currentUser.id);
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
        if (data?.user && !error) await fetchProfile(data.user.id);
        return { data, error };
    };

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (!error) setProfile(null);
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
