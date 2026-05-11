import React from 'react';

export default function Notifications() {
    return (
        <div>
            <div className="section-header">
                <h2 className="section-title">Notifications</h2>
            </div>
            
            <div className="empty-state" style={{ paddingTop: 60 }}>
                <span className="material-symbols-outlined empty-state-icon" style={{ color: 'var(--color-text-muted)', fontSize: 48 }}>notifications_off</span>
                <h3 style={{ fontWeight: 600, marginTop: 16 }}>No new notifications</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
                    We'll let you know when there's an update or recommendation for you.
                </p>
            </div>
        </div>
    );
}
