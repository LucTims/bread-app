import React from 'react';

export default function Search() {
    return (
        <div>
            <div className="search-bar">
                <span className="material-symbols-outlined" style={{ color: 'var(--color-text-muted)' }}>search</span>
                <input type="text" placeholder="Search books, authors, categories..." autoFocus />
            </div>
            
            <div className="empty-state" style={{ paddingTop: 60 }}>
                <span className="material-symbols-outlined empty-state-icon" style={{ color: 'var(--color-text-muted)', fontSize: 48 }}>manage_search</span>
                <h3 style={{ fontWeight: 600, marginTop: 16 }}>Find your next read</h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginTop: 8 }}>
                    Search through our library of premium books.
                </p>
            </div>
        </div>
    );
}
