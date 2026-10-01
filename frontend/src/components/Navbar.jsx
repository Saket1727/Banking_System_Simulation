import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Landmark, LogOut, ShieldCheck, User } from 'lucide-react';

export default function Navbar() {
    const { user, isAuthenticated, isAdmin, logout } = useAuth();
    const navigate = useNavigate();

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <header className="navbar">
            <div className="navbar-container">
                <Link to="/" className="navbar-brand">
                    <div className="brand-icon">
                        <Landmark size={22} color="#ffffff" />
                    </div>
                    <div>
                        <span className="brand-title">Horizon SimBank</span>
                        <span className="brand-subtitle">Simulated Core Engine</span>
                    </div>
                </Link>

                <nav className="navbar-actions">
                    {isAuthenticated ? (
                        <>
                            <div className="user-badge-group">
                                <div className="user-info">
                                    <span className="user-name">{user.fullName || user.username}</span>
                                    <span className={`role-tag ${isAdmin ? 'role-admin' : 'role-customer'}`}>
                                        {isAdmin ? <ShieldCheck size={12} /> : <User size={12} />}
                                        {user.role?.toUpperCase()}
                                    </span>
                                </div>
                            </div>

                            <button onClick={handleLogout} className="btn-logout" title="Sign Out">
                                <LogOut size={16} />
                                <span>Sign Out</span>
                            </button>
                        </>
                    ) : (
                        <div className="auth-links">
                            <Link to="/login" className="btn-secondary">Sign In</Link>
                            <Link to="/register" className="btn-primary">Open Account</Link>
                        </div>
                    )}
                </nav>
            </div>
        </header>
    );
}
