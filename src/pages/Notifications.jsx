import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft2, Trash, Book1, Refresh2, DiscountShape, Notification, NotificationBing, CloseCircle } from 'iconsax-react';
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
            return { icon: Book1, color: '#4facfe', label: 'Rappel de lecture' };
        case 'update':
            return { icon: Refresh2, color: '#43e97b', label: 'Mise à jour' };
        case 'promo':
            return { icon: DiscountShape, color: '#fa709a', label: 'Promotion' };
        default:
            return { icon: Notification, color: 'var(--color-primary)', label: 'Notification' };
    }
}

const ACTIVITY_TYPES = ['reminder'];

export default function Notifications() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [readIds, setReadIds] = useState(new Set());
    const [loading, setLoading] = useState(true);
    const [pushEnabled, setPushEnabled] = useState(false);
    const [pushLoading, setPushLoading] = useState(false);
    const [pushPermission, setPushPermission] = useState(() => getPushPermission());
    const [selectedNotif, setSelectedNotif] = useState(null);
    const [activeSection, setActiveSection] = useState('activity');

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
                if (sub) {
                    setPushEnabled(true);
                } else {
                    // Subscription failed — check if permission was denied
                    const perm = getPushPermission();
                    setPushPermission(perm);
                    if (perm === 'denied') {
                        alert("Les notifications sont bloquées par votre navigateur. Allez dans les paramètres de votre navigateur pour les autoriser.");
                    } else {
                        alert("Impossible d'activer les notifications. Vérifiez que l'application est installée ou réessayez plus tard.");
                    }
                }
            }
            setPushPermission(getPushPermission());
        } catch (err) {
            console.error('[Push] Toggle error:', err);
            alert("Erreur lors de l'activation des notifications. Réessayez plus tard.");
        } finally {
            setPushLoading(false);
        }
    };

    const filteredNotifications = notifications.filter(n =>
        activeSection === 'activity' ? ACTIVITY_TYPES.includes(n.type) : !ACTIVITY_TYPES.includes(n.type)
    );

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 80 }}>
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 40 }}>
            {/* En-tête — flèche retour, titre centré, tout marquer lu */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <button
                    onClick={() => navigate(-1)}
                    aria-label="Retour"
                    style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'var(--color-bg-dark)', border: 'none', cursor: 'pointer'
                    }}
                >
                    <ArrowLeft2 size={18} color="var(--color-text)" variant="Linear" />
                </button>
                <h2 style={{ fontSize: 19, fontWeight: 800, margin: 0 }}>Notifications</h2>
                <button
                    onClick={markAllAsRead}
                    aria-label="Tout marquer lu"
                    style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        background: 'none', border: 'none', cursor: 'pointer'
                    }}
                >
                    <Trash size={20} color="var(--color-text)" variant="Linear" />
                </button>
            </div>

            {/* Onglets */}
            <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
                {[
                    { key: 'activity', label: 'Activité' },
                    { key: 'news', label: 'Actualités quotidiennes' }
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveSection(tab.key)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            padding: '0 0 10px', fontSize: 14,
                            fontWeight: activeSection === tab.key ? 800 : 600,
                            color: activeSection === tab.key ? 'var(--color-text)' : 'var(--color-text-muted)',
                            borderBottom: activeSection === tab.key ? '2px solid var(--color-text)' : '2px solid transparent'
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
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
                            {pushEnabled
                                ? <NotificationBing size={20} color="#43e97b" variant="Linear" />
                                : <Notification size={20} color="var(--color-text-muted)" variant="Linear" />
                            }
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
            {filteredNotifications.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 60 }}>
                    <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.25 }}>
                        <Notification size={52} color="var(--color-text-muted)" variant="Linear" />
                    </div>
                    <h3 style={{ fontWeight: 700, marginTop: 14, fontSize: 15 }}>
                        Aucune notification
                    </h3>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, marginTop: 6 }}>
                        Vous serez notifié lorsque de nouveaux contenus ou rappels seront disponibles.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {filteredNotifications.map(notif => {
                        const isRead = readIds.has(notif.id);
                        const config = getTypeConfig(notif.type);
                        const Icon = config.icon;

                        return (
                            <div
                                key={notif.id}
                                onClick={() => {
                                    markAsRead(notif.id);
                                    setSelectedNotif(notif);
                                }}
                                style={{
                                    display: 'flex', gap: 14, padding: '12px 4px',
                                    alignItems: 'center', cursor: 'pointer'
                                }}
                            >
                                {/* Vignette */}
                                <div style={{
                                    position: 'relative', width: 64, height: 64, borderRadius: 12,
                                    overflow: 'hidden', flexShrink: 0,
                                    background: notif.image_url ? 'var(--color-bg-dark)' : `${config.color}18`
                                }}>
                                    {notif.image_url ? (
                                        <img src={notif.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Icon size={28} color={config.color} variant="Bold" />
                                        </div>
                                    )}
                                    {!isRead && (
                                        <span style={{
                                            position: 'absolute', top: 5, left: 5,
                                            width: 10, height: 10, borderRadius: '50%',
                                            background: 'var(--color-danger)', border: '2px solid var(--color-bg)'
                                        }} />
                                    )}
                                </div>

                                {/* Content */}
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <h4 style={{
                                        fontSize: 15, fontWeight: 700, margin: 0, lineHeight: 1.3,
                                        display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
                                    }}>
                                        {notif.title}
                                    </h4>
                                    <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
                                        {timeAgo(notif.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Detailed Notification Modal */}
            {selectedNotif && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                    zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: 20
                }} onClick={() => setSelectedNotif(null)}>
                    <div style={{
                        background: 'var(--color-bg)', width: '100%', maxWidth: 400,
                        borderRadius: 24, overflow: 'hidden',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
                        display: 'flex', flexDirection: 'column'
                    }} onClick={e => e.stopPropagation()}>
                        
                        {/* Header/Image Area */}
                        {selectedNotif.image_url ? (
                            <div style={{ width: '100%', height: 200, background: 'var(--color-bg-dark)', position: 'relative' }}>
                                <img src={selectedNotif.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                <button 
                                    onClick={() => setSelectedNotif(null)}
                                    style={{
                                        position: 'absolute', top: 12, right: 12,
                                        width: 32, height: 32, borderRadius: 16, border: 'none',
                                        background: 'rgba(0,0,0,0.5)', color: '#fff',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                        backdropFilter: 'blur(4px)'
                                    }}
                                >
                                    <CloseCircle size={18} color="#fff" variant="Linear" />
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 12px 0' }}>
                                <button 
                                    onClick={() => setSelectedNotif(null)}
                                    style={{
                                        width: 32, height: 32, borderRadius: 16, border: 'none',
                                        background: 'var(--color-bg-light)', color: 'var(--color-text)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                                    }}
                                >
                                    <CloseCircle size={18} color="var(--color-text)" variant="Linear" />
                                </button>
                            </div>
                        )}

                        {/* Content Area */}
                        <div style={{ padding: 24 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                {(() => {
                                    const config = getTypeConfig(selectedNotif.type);
                                    return (
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, padding: '4px 10px',
                                            borderRadius: 8, background: `${config.color}18`,
                                            color: config.color, textTransform: 'uppercase', letterSpacing: 0.5
                                        }}>
                                            {config.label}
                                        </span>
                                    );
                                })()}
                                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                                    {timeAgo(selectedNotif.created_at)}
                                </span>
                            </div>

                            <h2 style={{ fontSize: 20, fontWeight: 800, margin: '0 0 16px 0', lineHeight: 1.3, color: 'var(--color-primary-text)' }}>
                                {selectedNotif.title}
                            </h2>

                            <div style={{
                                fontSize: 14, color: 'var(--color-text)', lineHeight: 1.6,
                                whiteSpace: 'pre-wrap', maxHeight: '50vh', overflowY: 'auto'
                            }}>
                                {selectedNotif.body}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
