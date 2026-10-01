import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { UserPlus, AlertCircle, ArrowRight, ShieldAlert, CheckCircle2 } from 'lucide-react';

export default function Register() {
    const [formData, setFormData] = useState({
        fullName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { register } = useAuth();
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        try {
            await register({
                fullName: formData.fullName,
                username: formData.username,
                email: formData.email,
                password: formData.password
            });
            navigate('/dashboard');
        } catch (err) {
            setError(err.message || 'Registration failed. Please check your details.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="auth-card register-card">
                <div className="auth-header">
                    <div className="auth-icon-circle">
                        <UserPlus size={24} color="#2563eb" />
                    </div>
                    <h2>Create Customer Account</h2>
                    <p className="auth-sub">Open your simulated checking account with $1,000 demo credit</p>
                </div>

                {/* Explicit Security Notice Regarding Role Enforcement */}
                <div className="security-notice-box">
                    <ShieldAlert size={16} color="#0284c7" />
                    <div>
                        <strong>Role Policy:</strong> All public registrations are assigned standard <em>Customer</em> privileges. Administrative accounts cannot be registered publicly.
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
                        <label htmlFor="fullName">Full Name</label>
                        <input
                            id="fullName"
                            name="fullName"
                            type="text"
                            value={formData.fullName}
                            onChange={handleChange}
                            placeholder="e.g. Sarah Connor"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="username">Username</label>
                            <input
                                id="username"
                                name="username"
                                type="text"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="e.g. sarah_c"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="sarah@example.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label htmlFor="password">Password (min 8 chars)</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="confirmPassword">Confirm Password</label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <div className="perk-box">
                        <CheckCircle2 size={16} color="#16a34a" />
                        <span>Includes an automatic $1,000.00 starting simulated checking balance.</span>
                    </div>

                    <button type="submit" className="btn-submit" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Open Simulated Account'}
                        <ArrowRight size={16} />
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Already have an account? <Link to="/login">Sign In</Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
