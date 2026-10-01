import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('banksim_token') || null);
    const [isLoading, setIsLoading] = useState(true);

    // Hydrate user session on initial load
    useEffect(() => {
        async function loadUser() {
            const savedToken = localStorage.getItem('banksim_token');
            if (savedToken) {
                try {
                    const res = await authAPI.getMe();
                    if (res.success && res.user) {
                        setUser(res.user);
                    } else {
                        logout();
                    }
                } catch (err) {
                    console.error('[AuthContext] Session verification failed:', err.message);
                    logout();
                }
            }
            setIsLoading(false);
        }

        loadUser();
    }, []);

    const login = async (identifier, password) => {
        const res = await authAPI.login(identifier, password);
        if (res.success && res.token) {
            localStorage.setItem('banksim_token', res.token);
            setToken(res.token);
            setUser(res.user);
            return res.user;
        }
        throw new Error(res.error || 'Login failed');
    };

    const register = async (payload) => {
        const res = await authAPI.register(payload);
        if (res.success && res.token) {
            localStorage.setItem('banksim_token', res.token);
            setToken(res.token);
            setUser(res.user);
            return res.user;
        }
        throw new Error(res.error || 'Registration failed');
    };

    const logout = () => {
        localStorage.removeItem('banksim_token');
        setToken(null);
        setUser(null);
    };

    const value = {
        user,
        token,
        isAuthenticated: !!user,
        isAdmin: user?.role === 'admin',
        isCustomer: user?.role === 'customer',
        isLoading,
        login,
        register,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
