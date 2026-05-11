import React from 'react';
import { NavLink } from 'react-router-dom';

export default function BottomNav() {
    return (
        <nav className="bottom-nav">
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
                <span className="material-symbols-outlined">home</span>
                Home
            </NavLink>
            <NavLink to="/library" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">library_books</span>
                Library
            </NavLink>
            <NavLink to="/search" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">search</span>
                Search
            </NavLink>
            <NavLink to="/notifications" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">notifications</span>
                Notifications
            </NavLink>
            <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <span className="material-symbols-outlined">person</span>
                Profile
            </NavLink>
        </nav>
    );
}
