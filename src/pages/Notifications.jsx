import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { isPushSupported, getPushPermission, subscribeToPush, unsubscribeFromPush, isSubscribedToPush } from '../lib/pushManager';

function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);
    if (seconds < 60) return "À l'instant";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `Il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `Il y a ${days}j`;
    return date.toLocaleDateString('fr-FR', { dateStyle: 'medium' });
}

function getTypeConfig(type) {
    switch (type) {
        case 'reminder':
            return { icon: 'menu_book', color: '#4facfe', label: 'Rappel de lecture' };
        case 'update':
            return { icon: 'system_update', color: '#43e97b', label: 'Mise à jour' };
        case 'promo':
            return { icon: 'local_offer', color: '#fa709a', label: 'Promotion' };
        default:
            return { icon: 'notifications', color: 'var(--color-primary)', label: 'Notification' };
    }
}

export default function Notifications() {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [readIds, setReadIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [pushPermission, setPushPermission] = useState(() => getPushPermission());

    const loadNotifications = useCallback(async () => {
        if (!user) return;
        try {
            // Load all notifications
            const { data: notifs } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false });

            // Load which ones this user has read
            const { data: reads } = await supabase
                .from('notification_reads')
                .select('notification_id')
                .eq('user_id', user.id);

            setNotifications(notifs || []);
            setReadIds(new Set((reads || []).map(r => r.notification_id)));
        } catch (err) {
            console.error('[Notifs] Load error:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!user) return;
            await loadNotifications();
            if (!cancelled) {
                isSubscribedToPush().then(setPushEnabled);
            }
        })();
        return () => { cancelled = true; };
    }, [loadNotifications, user]);

    // Mark notification as read
    const markAsRead = async (notifId) => {
        if (readIds.has(notifId) || !user) return;
        try {
            await supabase.from('notification_reads').insert({
                notification_id: notifId,
                user_id: user.id
            });
            setReadIds(prev => new Set([...prev, notifId]));
        } catch (err) {
            console.error('[Notifs] Mark read error:', err);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        if (!user) return;
        const unread = notifications.filter(n => !readIds.has(n.id));
        if (unread.length === 0) return;

        try {
            const inserts = unread.map(n => ({
                notification_id: n.id,
                user_id: user.id
            }));
            await supabase.from('notification_reads').upsert(inserts, { onConflict: 'notification_id,user_id' });
            setReadIds(new Set(notifications.map(n => n.id)));
        } catch (err) {
            console.error('[Notifs] Mark all read error:', err);
        }
    };

    // Toggle push subscription
    const togglePush = async () => {
        if (!user) return;
        setPushLoading(true);
        try {
            if (pushEnabled) {
                await unsubscribeFromPush(user.id);
                setPushEnabled(false);
            } else {
                const sub = await subscribeToPush(user.id);
                setPushEnabled(!!sub);
                setPushPermission(getPushPermission());
            }
        } catch (err) {
            console.error('[Push] Toggle error:', err);
        } finally {
            setPushLoading(false);
        }
    };

    const unreadCount = notifications.filter(n => !readIds.has(n.id)).length;

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 40 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                    <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Notifications</h2>
                    {unreadCount > 0 && (
                        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                            {unreadCount} non-lue{unreadCount > 1 ? 's' : ''}
                        </p>
                    )}
                </div>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllAsRead}
                        style={{
                            padding: '6px 14px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                            background: 'var(--color-primary-light)', color: 'var(--color-primary-text)',
                            border: '1px solid rgba(255,215,0,0.2)', cursor: 'pointer'
                        }}
                    >
                        Tout marquer lu
                    </button>
                )}
            </div>

            {/* Push Notification Toggle Card */}
            {isPushSupported() && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '16px 18px', borderRadius: 16,
                    background: pushEnabled
                        ? 'linear-gradient(135deg, rgba(67,233,123,0.08), rgba(79,172,254,0.08))'
                        : 'var(--color-surface)',
                    border: pushEnabled
                        ? '1px solid rgba(67,233,123,0.2)'
                        : '1px solid var(--color-border)',
                    marginBottom: 20, transition: 'all 0.3s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{
                            width: 40, height: 40, borderRadius: 12,
                            background: pushEnabled ? 'rgba(67,233,123,0.15)' : 'var(--color-bg-dark)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <span className="material-symbols-outlined" style={{
                                fontSize: 20,
                                color: pushEnabled ? '#43e97b' : 'var(--color-text-muted)'
                            }}>
                                {pushEnabled ? 'notifications_active' : 'notifications_off'}
                            </span>
                        </div>
                        <div>
                            <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0 }}>
                                Notifications Push
                            </h4>
                            <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                                {pushPermission === 'denied'
                                    ? 'Bloqué par le navigateur'
                                    : pushEnabled
                                        ? 'Activées — vous recevrez des alertes'
                                        : 'Recevez des alertes sur votre appareil'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={togglePush}
                        disabled={pushLoading || pushPermission === 'denied'}
                        style={{
                            width: 48, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer',
                            background: pushEnabled ? '#43e97b' : 'var(--color-border)',
                            position: 'relative', transition: 'background 0.3s ease',
                            opacity: (pushLoading || pushPermission === 'denied') ? 0.5 : 1
                        }}
                    >
                        <div style={{
                            width: 22, height: 22, borderRadius: '50%', background: '#fff',
                            position: 'absolute', top: 3,
                            left: pushEnabled ? 23 : 3,
                            transition: 'left 0.3s ease',
                            boxShadow: '0 1px 4px rgba(0,0,0,0.2)'
                        }} />
                    </button>
                </div>
            )}

            {/* Notification List */}
            {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 60 }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 52, color: 'var(--color-text-muted)', opacity: 0.25
                    }}>notifications_off</span>
                    <h3 style={{ fontWeight: 700, marginTop: 14, fontSize: 15 }}>
                        Aucune notification
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 6 }}>
                        Vous serez notifié lorsque de nouveaux contenus ou rappels seront disponibles.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {notifications.map(notif => {
                        const isRead = readIds.has(notif.id);
                        const config = getTypeConfig(notif.type);

                        return (
                            <div
                                key={notif.id}
                                onClick={() => markAsRead(notif.id)}
                                style={{
                                    display: 'flex', gap: 14, padding: '16px 18px', borderRadius: 16,
                                    background: isRead ? 'var(--color-surface)' : 'var(--color-bg-light)',
                                    border: isRead
                                        ? '1px solid var(--color-border)'
                                        : `1px solid ${config.color}33`,
                                    cursor: isRead ? 'default' : 'pointer',
                                    transition: 'all 0.2s ease',
                                    opacity: isRead ? 0.7 : 1,
                                    position: 'relative'
                                }}
                            >
                                {/* Unread dot */}
                                {!isRead && (
                                    <div style={{
                                        position: 'absolute', top: 8, right: 8,
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: config.color,
                                        boxShadow: `0 0 8px ${config.color}60`
                                    }} />
                                )}

                                {/* Icon */}
                                <div style={{
                                    width: 42, height: 42, borderRadius: 12, flexShrink: 0,
                                    background: `${config.color}18`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    <span className="material-symbols-outlined" style={{
                                        fontSize: 20, color: config.color
                                    }}>{config.icon}</span>
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                                        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, lineHeight: 1.3 }}>
                                            {notif.title}
                                        </h4>
                                    </div>
                                    <p style={{
                                        fontSize: 12, color: 'var(--color-text-muted)',
                                        margin: '4px 0 0', lineHeight: 1.45
                                    }}>
                                        {notif.body}
                                    </p>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 8, marginTop: 8
                                    }}>
                                        <span style={{
                                            fontSize: 9, fontWeight: 700, padding: '2px 8px',
                                            borderRadius: 8, background: `${config.color}18`,
                                            color: config.color, textTransform: 'uppercase', letterSpacing: 0.5
                                        }}>
                                            {config.label}
                                        </span>
                                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                                            {timeAgo(notif.created_at)}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
