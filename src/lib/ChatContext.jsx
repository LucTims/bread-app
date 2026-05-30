import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import { useLocation } from 'react-router-dom';

const ChatContext = createContext({});

export function ChatProvider({ children }) {
    const { user } = useAuth();
    const location = useLocation();
    const [unreadCount, setUnreadCount] = useState(0);
    const channelRef = useRef(null);
    const lastReadRef = useRef(null);

    // Initial load: parse localStorage
    useEffect(() => {
        const storedLastRead = localStorage.getItem('last_chat_read');
        if (storedLastRead) {
            lastReadRef.current = new Date(storedLastRead);
        } else {
            lastReadRef.current = new Date();
            localStorage.setItem('last_chat_read', lastReadRef.current.toISOString());
        }

        // On first load, check how many messages we missed
        const fetchUnread = async () => {
            if (!user) return;
            try {
                const { count, error } = await supabase
                    .from('chat_messages')
                    .select('*', { count: 'exact', head: true })
                    .gt('created_at', lastReadRef.current.toISOString());
                
                if (!error && count) {
                    setUnreadCount(count);
                }
            } catch (err) {
                console.error('Error fetching unread count:', err);
            }
        };

        if (location.pathname !== '/chat') {
            fetchUnread();
        }
    }, [user]);

    // Handle Route change
    useEffect(() => {
        if (location.pathname === '/chat') {
            // User opened chat, reset unread count and update last read time
            setUnreadCount(0);
            const now = new Date();
            lastReadRef.current = now;
            localStorage.setItem('last_chat_read', now.toISOString());
        }
    }, [location.pathname]);

    // Subscribe to incoming messages
    useEffect(() => {
        if (!user) return;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
        }

        const channel = supabase
            .channel('chat_unread_tracker')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
                if (payload.new.user_id === user.id) return; // Don't count own messages
                
                if (location.pathname !== '/chat') {
                    setUnreadCount(prev => prev + 1);
                } else {
                    // Update last read time immediately if in chat
                    const now = new Date();
                    lastReadRef.current = now;
                    localStorage.setItem('last_chat_read', now.toISOString());
                }
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
            }
        };
    }, [user, location.pathname]);

    return (
        <ChatContext.Provider value={{ unreadCount, setUnreadCount }}>
            {children}
        </ChatContext.Provider>
    );
}

export const useChat = () => useContext(ChatContext);
