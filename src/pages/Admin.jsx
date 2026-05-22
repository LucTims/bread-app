import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';

export default function Admin() {
    const { user } = useAuth();
    const [tab, setTab] = useState('overview');
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        usersCount: 0,
        installsCount: 0,
        booksCount: 0,
        totalRevenue: 0,
        salesCount: 0
    });
    const [installs, setInstalls] = useState([]);
    const [orders, setOrders] = useState([]);
    const [searchQueries, setSearchQueries] = useState([]);
    const [users, setUsers] = useState([]);
    
    // Search/filter states
    const [installSearch, setInstallSearch] = useState('');
    const [userSearch, setUserSearch] = useState('');
    const [orderSearch, setOrderSearch] = useState('');

    // Notification states
    const [sentNotifs, setSentNotifs] = useState([]);
    const [notifTitle, setNotifTitle] = useState('');
    const [notifBody, setNotifBody] = useState('');
    const [notifType, setNotifType] = useState('reminder');
    const [notifImage, setNotifImage] = useState(null);
    const [sending, setSending] = useState(false);
    const [sendResult, setSendResult] = useState(null);

    const loadAdminData = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Total registered users
            const { count: usersCount } = await supabase
                .from('profiles')
                .select('id', { count: 'exact', head: true });

            // 2. Total library books
            const { count: booksCount } = await supabase
                .from('books')
                .select('id', { count: 'exact', head: true });

            // 3. Paid orders amount and counts
            const { data: paidOrders } = await supabase
                .from('orders')
                .select('total_amount')
                .eq('status', 'paid');
            
            const totalRevenue = (paidOrders || []).reduce((acc, o) => acc + Number(o.total_amount || 0), 0);
            const salesCount = paidOrders?.length || 0;

            // 4. PWA Installs
            const { data: installsData } = await supabase
                .from('pwa_installs')
                .select('*')
                .order('installed_at', { ascending: false });

            // 5. Recent orders list
            const { data: ordersData } = await supabase
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            // 6. Popular queries
            const { data: queriesData } = await supabase
                .from('search_queries')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);

            // 7. Complete users profiles
            const { data: profilesData } = await supabase
                .from('profiles')
                .select('*')
                .order('created_at', { ascending: false });

            // 8. Sent notifications
            const { data: notifsData } = await supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false });

            // 8b. Read counts per notification
            const notifIds = (notifsData || []).map(n => n.id);
            let readCounts = {};
            if (notifIds.length > 0) {
                const { data: readsData } = await supabase
                    .from('notification_reads')
                    .select('notification_id');
                (readsData || []).forEach(r => {
                    readCounts[r.notification_id] = (readCounts[r.notification_id] || 0) + 1;
                });
            }

            setStats({
                usersCount: usersCount || 0,
                installsCount: installsData?.length || 0,
                booksCount: booksCount || 0,
                totalRevenue: Math.round(totalRevenue * 100) / 100,
                salesCount: salesCount
            });

            setInstalls(installsData || []);
            setOrders(ordersData || []);
            setSearchQueries(queriesData || []);
            setUsers(profilesData || []);
            setSentNotifs((notifsData || []).map(n => ({ ...n, readCount: readCounts[n.id] || 0 })));

        } catch (err) {
            console.error('[Admin] Load stats error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            loadAdminData();
        }, 0);
        return () => clearTimeout(timer);
    }, [loadAdminData]);

    // Device breakdown calculation
    const getPlatformBreakdown = () => {
        const counts = { iOS: 0, Android: 0, Windows: 0, Mac: 0, Linux: 0, Autre: 0 };
        installs.forEach(inst => {
            const p = inst.platform || 'Autre';
            if (counts[p] !== undefined) counts[p]++;
            else counts.Autre++;
        });
        const total = installs.length || 1;
        return Object.entries(counts).map(([name, val]) => ({
            name,
            count: val,
            pct: Math.round((val / total) * 100)
        })).filter(item => item.count > 0).sort((a, b) => b.count - a.count);
    };

    // Filter installs
    const filteredInstalls = installs.filter(item => 
        (item.email || '').toLowerCase().includes(installSearch.toLowerCase()) ||
        (item.platform || '').toLowerCase().includes(installSearch.toLowerCase())
    );

    // Filter users
    const filteredUsers = users.filter(item => 
        (item.email || '').toLowerCase().includes(userSearch.toLowerCase()) ||
        (item.role || '').toLowerCase().includes(userSearch.toLowerCase())
    );

    // Filter orders
    const filteredOrders = orders.filter(item => 
        (item.customer_email || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
        (item.customer_name || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
        (item.payment_provider || '').toLowerCase().includes(orderSearch.toLowerCase()) ||
        (item.status || '').toLowerCase().includes(orderSearch.toLowerCase())
    );

    // Get platform badge color
    const getPlatformStyle = (p) => {
        switch(p) {
            case 'iOS': return { background: 'var(--color-border)', color: 'var(--color-text)', border: '1px solid var(--color-border)' };
            case 'Android': return { background: 'rgba(164,198,57,0.15)', color: '#a4c639', border: '1px solid rgba(164,198,57,0.3)' };
            case 'Windows': return { background: 'rgba(0,164,239,0.15)', color: '#00a4ef', border: '1px solid rgba(0,164,239,0.3)' };
            case 'Mac': return { background: 'var(--color-primary-light)', color: 'var(--color-primary-text)', border: '1px solid rgba(255,215,0,0.3)' };
            default: return { background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' };
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
                <div className="spinner" style={{ width: 40, height: 40 }} />
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Chargement des données réelles...</p>
            </div>
        );
    }

    return (
        <div style={{ paddingBottom: 60 }}>
            {/* Header d'Administration */}
            <div className="library-hero" style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-bg-light))', borderBottom: '1px solid var(--color-border)', padding: '36px 0', marginBottom: 24, borderRadius: 16, boxShadow: 'var(--shadow-md)' }}>
                <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 28, animation: 'pulse 2s infinite' }}>terminal</span>
                            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, background: 'linear-gradient(90deg, #FFD700, #FF8C00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Console d'Administration</h1>
                        </div>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: 0 }}>Statistiques en direct et suivi des installations</p>
                    </div>
                    <button onClick={loadAdminData} className="btn btn-ghost btn-sm" style={{ border: '1.5px solid var(--color-primary-text)', color: 'var(--color-primary-text)' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span> Rafraîchir
                    </button>
                </div>
            </div>

            {/* Navigation par Onglets */}
            <div className="container" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6, borderBottom: '1px solid var(--color-border)' }}>
                    {[
                        { id: 'overview', label: 'Vue d\'ensemble', icon: 'dashboard' },
                        { id: 'notifications', label: `Notifications (${sentNotifs.length})`, icon: 'campaign' },
                        { id: 'installs', label: `Téléchargements PWA (${stats.installsCount})`, icon: 'install_mobile' },
                        { id: 'orders', label: 'Ventes & Commandes', icon: 'payments' },
                        { id: 'users', label: `Utilisateurs (${stats.usersCount})`, icon: 'group' }
                    ].map(t => (
                        <button 
                            key={t.id} 
                            onClick={() => setTab(t.id)} 
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 20,
                                background: tab === t.id ? 'linear-gradient(135deg, var(--color-primary), #FFA000)' : 'var(--color-surface)',
                                color: tab === t.id ? '#000' : 'var(--color-text-muted)',
                                border: tab === t.id ? 'none' : '1px solid var(--color-border)', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                                transition: 'all 0.2s ease', cursor: 'pointer', boxShadow: tab === t.id ? '0 4px 12px rgba(255,215,0,0.2)' : 'none'
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>{t.icon}</span>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="container">
                {/* 1. ONGLET VUE D'ENSEMBLE */}
                {tab === 'overview' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* KPIs Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
                            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 20, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)' }}>INSTALLATIONS APP</span>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)', fontSize: 20 }}>install_mobile</span>
                                </div>
                                <h3 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>{stats.installsCount}</h3>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, fontSize: 11, color: 'var(--color-text-muted)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 12 }}>trending_up</span>
                                    <span>Taux actif élevé</span>
                                </div>
                            </div>

                            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 20, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)' }}>REVENU TOTAL</span>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-success)', fontSize: 20 }}>payments</span>
                                </div>
                                <h3 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--color-success)' }}>{stats.totalRevenue} €</h3>
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, margin: 0 }}>{stats.salesCount} ventes réelles encaissées</p>
                            </div>

                            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 20, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)' }}>LECTEURS INSCRITS</span>
                                    <span className="material-symbols-outlined" style={{ color: '#fa709a', fontSize: 20 }}>group</span>
                                </div>
                                <h3 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>{stats.usersCount}</h3>
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, margin: 0 }}>Comptes synchronisés</p>
                            </div>

                            <div className="card" style={{ display: 'flex', flexDirection: 'column', padding: 20, position: 'relative', overflow: 'hidden' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: 'var(--color-text-muted)' }}>LIVRES DISPONIBLES</span>
                                    <span className="material-symbols-outlined" style={{ color: '#fccb90', fontSize: 20 }}>book_2</span>
                                </div>
                                <h3 style={{ fontSize: 28, fontWeight: 800, margin: 0, color: 'var(--color-text)' }}>{stats.booksCount}</h3>
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, margin: 0 }}>Catalogue BRead</p>
                            </div>
                        </div>

                        {/* Breakdown and Search Query Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
                            {/* Platforms breakdown */}
                            <div className="card" style={{ padding: 24 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>pie_chart</span> Répartition des supports PWA
                                </h3>
                                {installs.length === 0 ? (
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Aucune donnée d'installation disponible.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                        {getPlatformBreakdown().map(p => (
                                            <div key={p.name}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4, fontWeight: 500 }}>
                                                    <span>{p.name}</span>
                                                    <span style={{ color: 'var(--color-text-muted)' }}>{p.count} install. ({p.pct}%)</span>
                                                </div>
                                                <div style={{ height: 8, borderRadius: 4, background: 'var(--color-border)', overflow: 'hidden' }}>
                                                    <div style={{
                                                        height: '100%', borderRadius: 4,
                                                        background: p.name === 'iOS' ? 'var(--color-text)' : p.name === 'Android' ? '#a4c639' : p.name === 'Windows' ? '#00a4ef' : p.name === 'Mac' ? 'var(--color-primary)' : 'var(--color-primary)',
                                                        width: `${p.pct}%`, transition: 'width 1s ease'
                                                    }} />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Popular queries */}
                            <div className="card" style={{ padding: 24 }}>
                                <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className="material-symbols-outlined" style={{ color: '#fa709a' }}>travel_explore</span> Dernières Recherches Utilisateurs
                                </h3>
                                {searchQueries.length === 0 ? (
                                    <p style={{ color: 'var(--color-text-muted)', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>Aucune recherche récente.</p>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 4 }}>
                                        {searchQueries.map((q, i) => (
                                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--color-bg-light)', border: '1px solid var(--color-border)', borderRadius: 10, fontSize: 12 }}>
                                                <span style={{ fontWeight: 600, color: 'var(--color-primary-text)' }}>"{q.query}"</span>
                                                <span style={{ color: 'var(--color-text-muted)', fontSize: 10 }}>{new Date(q.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. ONGLET NOTIFICATIONS */}
                {tab === 'notifications' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        {/* Compose Card */}
                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="material-symbols-outlined" style={{ color: 'var(--color-primary)' }}>edit_notifications</span>
                                Envoyer une notification
                            </h3>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {/* Type selector */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    {[
                                        { value: 'reminder', label: '📖 Rappel', icon: 'menu_book' },
                                        { value: 'update', label: '🔄 Mise à jour', icon: 'system_update' },
                                        { value: 'promo', label: '🏷️ Promo', icon: 'local_offer' }
                                    ].map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setNotifType(t.value)}
                                            style={{
                                                padding: '8px 14px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                                                background: notifType === t.value ? 'linear-gradient(135deg, var(--color-primary), #FFA000)' : 'var(--color-surface)',
                                                color: notifType === t.value ? '#000' : 'var(--color-text-muted)',
                                                border: notifType === t.value ? 'none' : '1px solid var(--color-border)',
                                                cursor: 'pointer', transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Title */}
                                <input
                                    type="text"
                                    placeholder="Titre de la notification..."
                                    value={notifTitle}
                                    onChange={e => setNotifTitle(e.target.value)}
                                    style={{
                                        padding: '12px 16px', borderRadius: 12,
                                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)', fontSize: 14, fontWeight: 600
                                    }}
                                />

                                {/* Body */}
                                <textarea
                                    placeholder="Message de la notification..."
                                    value={notifBody}
                                    onChange={e => setNotifBody(e.target.value)}
                                    rows={4}
                                    style={{
                                        padding: '12px 16px', borderRadius: 12,
                                        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
                                        color: 'var(--color-text)', fontSize: 13, resize: 'vertical',
                                        fontFamily: 'inherit', lineHeight: 1.5
                                    }}
                                />

                                {/* Image Upload */}
                                <div style={{
                                    border: '1px dashed var(--color-border)', borderRadius: 12, padding: '16px',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                                    background: 'var(--color-bg-light)', position: 'relative'
                                }}>
                                    <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)', fontSize: 24 }}>add_photo_alternate</span>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', textAlign: 'center' }}>
                                        {notifImage ? (
                                            <span style={{ color: 'var(--color-primary-text)', fontWeight: 600 }}>{notifImage.name}</span>
                                        ) : (
                                            <span>Ajouter une image (optionnel)</span>
                                        )}
                                    </div>
                                    {notifImage && (
                                        <button 
                                            onClick={() => setNotifImage(null)}
                                            style={{
                                                position: 'absolute', top: 8, right: 8, background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                                                border: 'none', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: 'pointer'
                                            }}
                                        >
                                            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                                        </button>
                                    )}
                                    <input 
                                        type="file" 
                                        accept="image/png, image/jpeg, image/webp"
                                        onChange={e => setNotifImage(e.target.files[0])}
                                        style={{
                                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer'
                                        }}
                                    />
                                </div>

                                {/* Send button */}
                                <button
                                    onClick={async () => {
                                        if (!notifTitle.trim() || !notifBody.trim()) return;
                                        setSending(true);
                                        setSendResult(null);
                                        try {
                                            let imageUrl = null;

                                            // 0. Upload image if selected
                                            if (notifImage) {
                                                const fileExt = notifImage.name.split('.').pop();
                                                const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                                                const { error: uploadErr } = await supabase.storage
                                                    .from('notification-images')
                                                    .upload(fileName, notifImage);
                                                
                                                if (uploadErr) throw uploadErr;

                                                const { data: { publicUrl } } = supabase.storage
                                                    .from('notification-images')
                                                    .getPublicUrl(fileName);
                                                
                                                imageUrl = publicUrl;
                                            }

                                            // 1. Insert notification
                                            const { data: newNotif, error: insertErr } = await supabase
                                                .from('notifications')
                                                .insert({
                                                    title: notifTitle.trim(),
                                                    body: notifBody.trim(),
                                                    type: notifType,
                                                    image_url: imageUrl,
                                                    sent_by: user?.id
                                                })
                                                .select()
                                                .single();

                                            if (insertErr) throw insertErr;

                                            // 2. Try to send push notifications (via Edge Function)
                                            let pushCount = 0;
                                            try {
                                                const { data: subs } = await supabase
                                                    .from('push_subscriptions')
                                                    .select('endpoint, keys_p256dh, keys_auth');
                                                pushCount = subs?.length || 0;

                                                // Call edge function if available
                                                if (pushCount > 0) {
                                                    try {
                                                        await supabase.functions.invoke('send-push-notification', {
                                                            body: {
                                                                title: notifTitle.trim(),
                                                                body: notifBody.trim(),
                                                                type: notifType,
                                                                image_url: imageUrl
                                                            }
                                                        });
                                                    } catch (pushErr) {
                                                        console.warn('[Admin] Push function not deployed yet:', pushErr);
                                                    }
                                                }
                                            } catch (pushErr) {
                                                console.warn('[Admin] Push subs query error:', pushErr);
                                            }

                                            setSendResult({
                                                success: true,
                                                message: `✅ Notification envoyée à ${stats.usersCount} utilisateurs${pushCount > 0 ? ` (${pushCount} push)` : ''}`
                                            });

                                            // Clear form
                                            setNotifTitle('');
                                            setNotifBody('');
                                            setNotifType('reminder');
                                            setNotifImage(null);

                                            // Refresh data
                                            setSentNotifs(prev => [{ ...newNotif, readCount: 0 }, ...prev]);

                                        } catch (err) {
                                            console.error('[Admin] Send notification error:', err);
                                            setSendResult({ success: false, message: `❌ Erreur: ${err.message}` });
                                        } finally {
                                            setSending(false);
                                            setTimeout(() => setSendResult(null), 5000);
                                        }
                                    }}
                                    disabled={sending || !notifTitle.trim() || !notifBody.trim()}
                                    style={{
                                        padding: '14px 24px', borderRadius: 14, fontSize: 14, fontWeight: 700,
                                        background: (!notifTitle.trim() || !notifBody.trim()) ? 'var(--color-border)' : 'linear-gradient(135deg, var(--color-primary), #FFA000)',
                                        color: (!notifTitle.trim() || !notifBody.trim()) ? 'var(--color-text-muted)' : '#000',
                                        border: 'none', cursor: sending ? 'wait' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                        transition: 'all 0.2s ease', opacity: sending ? 0.7 : 1
                                    }}
                                >
                                    {sending ? (
                                        <>
                                            <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2, margin: 0 }} />
                                            Envoi en cours...
                                        </>
                                    ) : (
                                        <>
                                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
                                            Envoyer la notification
                                        </>
                                    )}
                                </button>

                                {/* Send result */}
                                {sendResult && (
                                    <div style={{
                                        padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
                                        background: sendResult.success ? 'rgba(67,233,123,0.1)' : 'rgba(239,68,68,0.1)',
                                        color: sendResult.success ? '#43e97b' : '#ef4444',
                                        border: sendResult.success ? '1px solid rgba(67,233,123,0.2)' : '1px solid rgba(239,68,68,0.2)',
                                        animation: 'fadeIn 0.3s ease'
                                    }}>
                                        {sendResult.message}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Sent Notifications History */}
                        <div className="card" style={{ padding: 24 }}>
                            <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="material-symbols-outlined" style={{ color: '#4facfe' }}>history</span>
                                Historique des notifications
                            </h3>

                            {sentNotifs.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3 }}>notifications_off</span>
                                    <p style={{ fontSize: 13, margin: '12px 0 0' }}>Aucune notification envoyée.</p>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    {sentNotifs.map(n => (
                                        <div key={n.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '14px 16px', borderRadius: 12,
                                            background: 'var(--color-bg-light)', border: '1px solid var(--color-border)'
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: 12, alignItems: 'center' }}>
                                                {n.image_url && (
                                                    <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', flexShrink: 0, border: '1px solid var(--color-border)' }}>
                                                        <img src={n.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    </div>
                                                )}
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <span style={{
                                                            fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                                                            background: n.type === 'reminder' ? 'rgba(79,172,254,0.15)' : n.type === 'update' ? 'rgba(67,233,123,0.15)' : 'rgba(250,112,154,0.15)',
                                                            color: n.type === 'reminder' ? '#4facfe' : n.type === 'update' ? '#43e97b' : '#fa709a',
                                                            textTransform: 'uppercase'
                                                        }}>
                                                            {n.type === 'reminder' ? 'Rappel' : n.type === 'update' ? 'MAJ' : 'Promo'}
                                                        </span>
                                                        <h4 style={{ fontSize: 13, fontWeight: 700, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                            {n.title}
                                                        </h4>
                                                    </div>
                                                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: '4px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {n.body}
                                                    </p>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0, marginLeft: 16 }}>
                                                <div style={{ textAlign: 'right' }}>
                                                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text)' }}>
                                                        👁 {n.readCount} lu{n.readCount !== 1 ? 's' : ''}
                                                    </div>
                                                    <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                        {new Date(n.created_at).toLocaleDateString('fr-FR', { dateStyle: 'short' })}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        if (window.confirm("Supprimer cette notification définitivement ?")) {
                                                            try {
                                                                await supabase.from('notifications').delete().eq('id', n.id);
                                                                setSentNotifs(prev => prev.filter(x => x.id !== n.id));
                                                            } catch {
                                                                alert("Erreur de suppression");
                                                            }
                                                        }
                                                    }}
                                                    style={{
                                                        background: 'transparent', border: 'none', color: '#ef4444', opacity: 0.6,
                                                        cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center'
                                                    }}
                                                >
                                                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>delete</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. ONGLET TÉLÉCHARGEMENTS PWA */}
                {tab === 'installs' && (
                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Lecteurs ayant téléchargé l'App</h3>
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>Identifiants uniques ayant installé la PWA hors-ligne</p>
                            </div>
                            <input 
                                type="text"
                                placeholder="Rechercher par email ou plateforme..."
                                value={installSearch}
                                onChange={e => setInstallSearch(e.target.value)}
                                style={{
                                    padding: '8px 14px', borderRadius: 12, background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, width: '100%', maxWidth: 260
                                }}
                            />
                        </div>

                        {filteredInstalls.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>wifi_tethering_off</span>
                                <p style={{ fontSize: 13, margin: 0 }}>Aucun téléchargement trouvé pour votre recherche.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Utilisateur</th>
                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Support / OS</th>
                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Date d'installation</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredInstalls.map((item) => (
                                            <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)', transition: 'background 0.2s' }}>
                                                <td style={{ padding: '14px 8px', fontWeight: 600 }}>{item.email || 'Utilisateur Anonyme'}</td>
                                                <td style={{ padding: '14px 8px' }}>
                                                    <span style={{
                                                        padding: '4px 10px', borderRadius: 12, fontSize: 10, fontWeight: 700,
                                                        display: 'inline-flex', alignItems: 'center', gap: 4, ...getPlatformStyle(item.platform)
                                                    }}>
                                                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                                                            {item.platform === 'iOS' ? 'phone_iphone' : item.platform === 'Android' ? 'phone_android' : 'desktop_windows'}
                                                        </span>
                                                        {item.platform || 'Autre'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 8px', color: 'var(--color-text-muted)' }}>
                                                    {new Date(item.installed_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* 3. ONGLET VENTES & COMMANDES */}
                {tab === 'orders' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div className="card" style={{ padding: 24 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                                <div>
                                    <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Ventes réelles enregistrées</h3>
                                    <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>Commandes passées sur BoomBooks synchronisées</p>
                                </div>
                                <input 
                                    type="text"
                                    placeholder="Filtrer par email, nom, statut..."
                                    value={orderSearch}
                                    onChange={e => setOrderSearch(e.target.value)}
                                    style={{
                                        padding: '8px 14px', borderRadius: 12, background: 'var(--color-bg)',
                                        border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, width: '100%', maxWidth: 260
                                    }}
                                />
                            </div>

                            {filteredOrders.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                                    <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>payments</span>
                                    <p style={{ fontSize: 13, margin: 0 }}>Aucune vente trouvée.</p>
                                </div>
                            ) : (
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Client / Email</th>
                                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Montant</th>
                                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Paiement</th>
                                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Statut</th>
                                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Source / Pays</th>
                                                <th style={{ padding: '12px 8px', fontWeight: 600 }}>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredOrders.map((ord) => (
                                                <tr key={ord.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                    <td style={{ padding: '14px 8px' }}>
                                                        <div style={{ fontWeight: 600 }}>{ord.customer_name || 'Inconnu'}</div>
                                                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>{ord.customer_email || 'Pas d\'email'}</div>
                                                    </td>
                                                    <td style={{ padding: '14px 8px', fontWeight: 700, color: ord.status === 'paid' ? 'var(--color-success)' : 'var(--color-text)' }}>
                                                        {ord.total_amount} €
                                                    </td>
                                                    <td style={{ padding: '14px 8px', fontSize: 11, textTransform: 'capitalize' }}>
                                                        {ord.payment_provider || '-'}
                                                    </td>
                                                    <td style={{ padding: '14px 8px' }}>
                                                        <span style={{
                                                            padding: '2px 8px', borderRadius: 10, fontSize: 9, fontWeight: 700,
                                                            background: ord.status === 'paid' ? 'rgba(67,233,123,0.15)' : 'rgba(255,160,0,0.15)',
                                                            color: ord.status === 'paid' ? '#43e97b' : '#ffa000',
                                                            border: ord.status === 'paid' ? '1px solid rgba(67,233,123,0.3)' : '1px solid rgba(255,160,0,0.3)'
                                                        }}>
                                                            {ord.status === 'paid' ? 'Payé' : 'En attente'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '14px 8px' }}>
                                                        <div>{ord.customer_country || 'FR'}</div>
                                                        {ord.traffic_source && <div style={{ fontSize: 9, color: 'var(--color-primary-text)' }}>{ord.traffic_source}</div>}
                                                    </td>
                                                    <td style={{ padding: '14px 8px', color: 'var(--color-text-muted)' }}>
                                                        {new Date(ord.created_at).toLocaleDateString('fr-FR')}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. ONGLET UTILISATEURS */}
                {tab === 'users' && (
                    <div className="card" style={{ padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                            <div>
                                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Profils des Utilisateurs Synchronisés</h3>
                                <p style={{ fontSize: 11, color: 'var(--color-text-muted)', margin: 0 }}>Comptes créés sur BRead ou synchronisés de BoomBooks</p>
                            </div>
                            <input 
                                type="text"
                                placeholder="Rechercher par email ou rôle..."
                                value={userSearch}
                                onChange={e => setUserSearch(e.target.value)}
                                style={{
                                    padding: '8px 14px', borderRadius: 12, background: 'var(--color-bg)',
                                    border: '1px solid var(--color-border)', color: 'var(--color-text)', fontSize: 12, width: '100%', maxWidth: 260
                                }}
                            />
                        </div>

                        {filteredUsers.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-muted)' }}>
                                <span className="material-symbols-outlined" style={{ fontSize: 48, opacity: 0.3, marginBottom: 12 }}>group_off</span>
                                <p style={{ fontSize: 13, margin: 0 }}>Aucun utilisateur trouvé.</p>
                            </div>
                        ) : (
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--color-border)', color: 'var(--color-text-muted)' }}>
                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Adresse E-mail</th>
                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Rôle</th>
                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Date d'inscription</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredUsers.map((u) => (
                                            <tr key={u.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                                                <td style={{ padding: '14px 8px', fontWeight: 600 }}>{u.email}</td>
                                                <td style={{ padding: '14px 8px' }}>
                                                    <span style={{
                                                        padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 700,
                                                        background: u.role === 'admin' ? 'var(--color-primary-light)' : 'var(--color-bg-dark)',
                                                        color: u.role === 'admin' ? 'var(--color-primary-text)' : 'var(--color-text-muted)',
                                                        border: u.role === 'admin' ? '1px solid rgba(255, 215, 0, 0.3)' : '1px solid var(--color-border)'
                                                    }}>
                                                        {u.role === 'admin' ? '🛠️ Administrateur' : '👤 Lecteur'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '14px 8px', color: 'var(--color-text-muted)' }}>
                                                    {new Date(u.created_at).toLocaleDateString('fr-FR', { dateStyle: 'medium' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
