import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, User, AlertCircle, ArrowRight, Shield, Sparkles } from 'lucide-react';

export default function Login() {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await login(identifier, password);
            if (user.role === 'admin') {
                navigate('/admin');
            } else {
                navigate('/dashboard');
            }
        } catch (err) {
            setError(err.message || 'Login failed. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    const fillDemoCustomer = () => {
        setIdentifier('john_doe');
        setPassword('Customer@12345');
        setError('');
    };

    const fillDemoAdmin = () => {
        setIdentifier('admin');
        setPassword('Admin@12345');
        setError('');
    };

    return (
        <div className="auth-page">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-icon-circle">
                        <Lock size={24} color="#2563eb" />
                    </div>
                    <h2>Sign In to SimBank</h2>
                    <p className="auth-sub">Access your simulated accounts and banking ledger</p>
                </div>

                {/* Quick Demo Credentials for Interviews */}
                <div className="demo-credentials-box">
                    <div className="demo-header">
                        <Sparkles size={14} color="#d97706" />
                        <span>Demo Quick-Fill (For Interviews & Testing)</span>
                    </div>
                    <div className="demo-buttons">
                        <button type="button" onClick={fillDemoCustomer} className="btn-demo customer">
                            <User size={13} />
                            Customer Demo
                        </button>
                        <button type="button" onClick={fillDemoAdmin} className="btn-demo admin">
                            <Shield size={13} />
                            Admin Demo
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="alert-error">
                        <AlertCircle size={16} />
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="identifier">Username or Email</label>
                        <input
                            id="identifier"
                            type="text"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="e.g. john_doe or admin"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? 'Authenticating...' : 'Sign In'}
                        <ArrowRight size={16} />
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        New customer? <Link to="/register">Open a simulated account</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
