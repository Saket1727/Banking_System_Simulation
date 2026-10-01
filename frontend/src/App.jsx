import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import SimulationBanner from './components/SimulationBanner';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import './App.css';

// Root redirector based on authenticated role
function RootRedirect() {
    const { isAuthenticated, isAdmin, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="spinner"></div>
                <p>Loading application...</p>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    return <Navigate to="/dashboard" replace />;
}

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <div className="app-layout">
                    {/* Educational Simulation Disclaimer Banner */}
                    <SimulationBanner />
                    
                    {/* Navigation Header */}
                    <Navbar />

                    {/* Main Content Area */}
                    <main className="main-content">
                        <Routes>
                            {/* Public Routes */}
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />

                            {/* Customer Portal */}
                            <Route 
                                path="/dashboard" 
                                element={
                                    <ProtectedRoute allowedRoles={['customer', 'admin']}>
                                        <CustomerDashboard />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Admin Console */}
                            <Route 
                                path="/admin" 
                                element={
                                    <ProtectedRoute allowedRoles={['admin']}>
                                        <AdminDashboard />
                                    </ProtectedRoute>
                                } 
                            />

                            {/* Default Fallback */}
                            <Route path="/" element={<RootRedirect />} />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </main>
                </div>
            </BrowserRouter>
        </AuthProvider>
    );
}
