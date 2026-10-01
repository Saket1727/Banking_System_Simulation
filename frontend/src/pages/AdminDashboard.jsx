import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminAPI } from '../services/api';
import { 
    Shield, 
    Users, 
    Landmark, 
    FileText, 
    Snowflake, 
    Sun, 
    Slash, 
    PlusCircle, 
    CheckCircle2, 
    AlertCircle, 
    X, 
    RefreshCw, 
    Clock,
    Lock
} from 'lucide-react';

export default function AdminDashboard() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('ACCOUNTS'); // 'ACCOUNTS', 'CUSTOMERS', 'PROVISION', 'AUDIT'
    const [accounts, setAccounts] = useState([]);
    const [users, setUsers] = useState([]);
    const [auditLogs, setAuditLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState({ type: '', message: '' });

    // Status action modal state
    const [statusModal, setStatusModal] = useState({
        isOpen: false,
        account: null,
        targetStatus: '',
        reason: ''
    });

    // Account creation form state
    const [provisionForm, setProvisionForm] = useState({
        userId: '',
        accountType: 'CHECKING',
        initialBalance: '0.00'
    });
    const [provisionLoading, setProvisionLoading] = useState(false);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            const [accRes, userRes, auditRes] = await Promise.all([
                adminAPI.getAllAccounts(),
                adminAPI.getAllUsers('customer'),
                adminAPI.getAuditLogs({ limit: 50 })
            ]);

            if (accRes.success) setAccounts(accRes.accounts);
            if (userRes.success) {
                setUsers(userRes.users);
                if (userRes.users.length > 0 && !provisionForm.userId) {
                    setProvisionForm(prev => ({ ...prev, userId: userRes.users[0].id }));
                }
            }
            if (auditRes.success) setAuditLogs(auditRes.logs);
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Failed to fetch admin data.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAllData();
    }, []);

    const openStatusModal = (account, targetStatus) => {
        setStatusModal({
            isOpen: true,
            account,
            targetStatus,
            reason: ''
        });
        setFeedback({ type: '', message: '' });
    };

    const closeStatusModal = () => {
        setStatusModal({ isOpen: false, account: null, targetStatus: '', reason: '' });
    };

    const handleStatusTransition = async (e) => {
        e.preventDefault();
        const { account, targetStatus, reason } = statusModal;

        if (targetStatus === 'CLOSED' && parseFloat(account.balance) > 0) {
            setFeedback({
                type: 'error',
                message: `Cannot close account ${account.account_number}. Balance must be $0.00 (currently $${parseFloat(account.balance).toFixed(2)}).`
            });
            closeStatusModal();
            return;
        }

        try {
            const res = await adminAPI.updateAccountStatus(account.id, targetStatus, reason);
            setFeedback({ type: 'success', message: res.message });
            closeStatusModal();
            await fetchAllData();
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Failed to update account status.' });
            closeStatusModal();
        }
    };

    const handleProvisionAccount = async (e) => {
        e.preventDefault();
        setProvisionLoading(true);
        setFeedback({ type: '', message: '' });

        try {
            const res = await adminAPI.createAccount(
                provisionForm.userId,
                provisionForm.accountType,
                parseFloat(provisionForm.initialBalance) || 0.00
            );
            setFeedback({ type: 'success', message: res.message });
            setProvisionForm({
                userId: users.length > 0 ? users[0].id : '',
                accountType: 'CHECKING',
                initialBalance: '0.00'
            });
            setActiveTab('ACCOUNTS');
            await fetchAllData();
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Failed to provision account.' });
        } finally {
            setProvisionLoading(false);
        }
    };

    const totalSystemBalance = accounts.reduce((acc, a) => acc + parseFloat(a.balance || 0), 0);

    return (
        <div className="dashboard-container admin-container">
            {/* Admin Header */}
            <div className="dashboard-header">
                <div>
                    <div className="admin-badge-title">
                        <Shield size={18} color="#9333ea" />
                        <span>System Administration Console</span>
                    </div>
                    <h1>Central Bank Operations</h1>
                    <p className="subtitle">Oversee customer accounts, enforce lifecycle states, and review audit logs</p>
                </div>
                <div className="header-actions">
                    <button onClick={fetchAllData} className="btn-refresh">
                        <RefreshCw size={16} />
                        <span>Refresh Console</span>
                    </button>
                    <button onClick={() => setActiveTab('PROVISION')} className="btn-action admin-create">
                        <PlusCircle size={16} />
                        <span>Provision Account</span>
                    </button>
                </div>
            </div>

            {/* Notification Banner */}
            {feedback.message && (
                <div className={`alert-banner ${feedback.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                    {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{feedback.message}</span>
                    <button onClick={() => setFeedback({ type: '', message: '' })} className="alert-close"><X size={14} /></button>
                </div>
            )}

            {/* System Overview Metrics */}
            <div className="metrics-row admin-metrics">
                <div className="metric-card">
                    <div className="metric-header">
                        <span className="metric-title">Total System Deposits</span>
                        <Landmark size={20} color="#2563eb" />
                    </div>
                    <div className="metric-value font-mono">
                        ${totalSystemBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="metric-footer">Aggregate simulated funds</div>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <span className="metric-title">Active Bank Accounts</span>
                        <Lock size={20} color="#16a34a" />
                    </div>
                    <div className="metric-value">{accounts.filter(a => a.status === 'ACTIVE').length} / {accounts.length}</div>
                    <div className="metric-footer">{accounts.filter(a => a.status === 'FROZEN').length} frozen, {accounts.filter(a => a.status === 'CLOSED').length} closed</div>
                </div>

                <div className="metric-card">
                    <div className="metric-header">
                        <span className="metric-title">Registered Customers</span>
                        <Users size={20} color="#9333ea" />
                    </div>
                    <div className="metric-value">{users.length}</div>
                    <div className="metric-footer">Verified customer accounts</div>
                </div>
            </div>

            {/* Admin Navigation Tabs */}
            <div className="admin-nav-tabs">
                <button 
                    className={`admin-tab ${activeTab === 'ACCOUNTS' ? 'active' : ''}`}
                    onClick={() => setActiveTab('ACCOUNTS')}
                >
                    <Landmark size={16} />
                    <span>System Accounts ({accounts.length})</span>
                </button>
                <button 
                    className={`admin-tab ${activeTab === 'CUSTOMERS' ? 'active' : ''}`}
                    onClick={() => setActiveTab('CUSTOMERS')}
                >
                    <Users size={16} />
                    <span>Customer Directory ({users.length})</span>
                </button>
                <button 
                    className={`admin-tab ${activeTab === 'PROVISION' ? 'active' : ''}`}
                    onClick={() => setActiveTab('PROVISION')}
                >
                    <PlusCircle size={16} />
                    <span>Provision Account</span>
                </button>
                <button 
                    className={`admin-tab ${activeTab === 'AUDIT' ? 'active' : ''}`}
                    onClick={() => setActiveTab('AUDIT')}
                >
                    <FileText size={16} />
                    <span>Audit Trail ({auditLogs.length})</span>
                </button>
            </div>

            {/* TAB 1: System Accounts */}
            {activeTab === 'ACCOUNTS' && (
                <section className="section-block">
                    <div className="table-wrapper">
                        <table className="ledger-table admin-table">
                            <thead>
                                <tr>
                                    <th>Account #</th>
                                    <th>Owner</th>
                                    <th>Type</th>
                                    <th className="text-right">Balance</th>
                                    <th>Status</th>
                                    <th>Created</th>
                                    <th className="text-center">Lifecycle Management</th>
                                </tr>
                            </thead>
                            <tbody>
                                {accounts.map(acc => (
                                    <tr key={acc.id} className={acc.status === 'CLOSED' ? 'row-closed' : ''}>
                                        <td className="code-text font-bold">{acc.account_number}</td>
                                        <td>
                                            <div className="owner-cell">
                                                <strong>{acc.full_name}</strong>
                                                <small className="text-muted">@{acc.username}</small>
                                            </div>
                                        </td>
                                        <td><span className="account-type-tag">{acc.account_type}</span></td>
                                        <td className="text-right font-mono font-bold">
                                            ${parseFloat(acc.balance).toFixed(2)}
                                        </td>
                                        <td>
                                            <span className={`status-pill status-${acc.status.toLowerCase()}`}>
                                                {acc.status}
                                            </span>
                                        </td>
                                        <td className="text-muted text-sm">
                                            {new Date(acc.created_at).toLocaleDateString()}
                                        </td>
                                        <td>
                                            <div className="admin-row-actions">
                                                {acc.status === 'ACTIVE' && (
                                                    <button 
                                                        onClick={() => openStatusModal(acc, 'FROZEN')} 
                                                        className="btn-status-action btn-freeze"
                                                        title="Freeze account to prevent transactions"
                                                    >
                                                        <Snowflake size={13} />
                                                        <span>Freeze</span>
                                                    </button>
                                                )}

                                                {acc.status === 'FROZEN' && (
                                                    <button 
                                                        onClick={() => openStatusModal(acc, 'ACTIVE')} 
                                                        className="btn-status-action btn-unfreeze"
                                                        title="Restore active status"
                                                    >
                                                        <Sun size={13} />
                                                        <span>Unfreeze</span>
                                                    </button>
                                                )}

                                                {acc.status !== 'CLOSED' && (
                                                    <button 
                                                        onClick={() => openStatusModal(acc, 'CLOSED')} 
                                                        className="btn-status-action btn-close-acc"
                                                        title="Permanently close account (Requires $0 balance)"
                                                    >
                                                        <Slash size={13} />
                                                        <span>Close</span>
                                                    </button>
                                                )}

                                                {acc.status === 'CLOSED' && (
                                                    <span className="text-muted text-xs italic">Permanently Closed</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* TAB 2: Customer Directory */}
            {activeTab === 'CUSTOMERS' && (
                <section className="section-block">
                    <div className="table-wrapper">
                        <table className="ledger-table">
                            <thead>
                                <tr>
                                    <th>Customer Name</th>
                                    <th>Username</th>
                                    <th>Email</th>
                                    <th>Accounts</th>
                                    <th className="text-right">Total Balance</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id}>
                                        <td><strong>{u.full_name}</strong></td>
                                        <td className="code-text">@{u.username}</td>
                                        <td className="text-muted">{u.email}</td>
                                        <td><span className="badge-count">{u.account_count} accounts</span></td>
                                        <td className="text-right font-mono font-bold">
                                            ${parseFloat(u.total_simulated_balance).toFixed(2)}
                                        </td>
                                        <td>
                                            <button 
                                                onClick={() => {
                                                    setProvisionForm(prev => ({ ...prev, userId: u.id }));
                                                    setActiveTab('PROVISION');
                                                }}
                                                className="btn-card-action highlight"
                                            >
                                                + Provision Account
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* TAB 3: Provision Customer Account Form */}
            {activeTab === 'PROVISION' && (
                <section className="section-block provision-section">
                    <div className="provision-card">
                        <div className="form-header">
                            <PlusCircle size={22} color="#2563eb" />
                            <h3>Create Customer Bank Account</h3>
                        </div>
                        <p className="subtitle">Provision a new simulated checking or savings account on behalf of a registered customer.</p>

                        <form onSubmit={handleProvisionAccount} className="modal-form">
                            <div className="form-group">
                                <label>Target Customer</label>
                                <select 
                                    value={provisionForm.userId}
                                    onChange={(e) => setProvisionForm({ ...provisionForm, userId: e.target.value })}
                                    required
                                >
                                    {users.map(u => (
                                        <option key={u.id} value={u.id}>
                                            {u.full_name} (@{u.username}) — {u.email}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Account Type</label>
                                <select 
                                    value={provisionForm.accountType}
                                    onChange={(e) => setProvisionForm({ ...provisionForm, accountType: e.target.value })}
                                >
                                    <option value="CHECKING">CHECKING (Everyday transactions)</option>
                                    <option value="SAVINGS">SAVINGS (High-yield interest simulation)</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Initial Deposit Balance ($ USD)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    min="0.00" 
                                    placeholder="0.00"
                                    value={provisionForm.initialBalance}
                                    onChange={(e) => setProvisionForm({ ...provisionForm, initialBalance: e.target.value })}
                                    required
                                />
                                <small className="hint">Optional opening balance automatically credited into the new account.</small>
                            </div>

                            <button type="submit" className="btn-submit" disabled={provisionLoading}>
                                {provisionLoading ? 'Provisioning...' : 'Provision Bank Account'}
                            </button>
                        </form>
                    </div>
                </section>
            )}

            {/* TAB 4: Audit Logs */}
            {activeTab === 'AUDIT' && (
                <section className="section-block">
                    <div className="table-wrapper">
                        <table className="ledger-table">
                            <thead>
                                <tr>
                                    <th>Timestamp</th>
                                    <th>Admin</th>
                                    <th>Action</th>
                                    <th>Target Account</th>
                                    <th>Audit Details & Reason</th>
                                </tr>
                            </thead>
                            <tbody>
                                {auditLogs.length === 0 ? (
                                    <tr><td colSpan="5" className="empty-row">No administrative actions logged yet.</td></tr>
                                ) : (
                                    auditLogs.map(log => (
                                        <tr key={log.id}>
                                            <td className="text-muted text-sm">
                                                <div className="cell-datetime">
                                                    <Clock size={12} />
                                                    <span>{new Date(log.created_at).toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="role-tag role-admin">
                                                    <Shield size={11} />
                                                    @{log.admin_username || 'system'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`type-badge badge-${log.action.toLowerCase()}`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="code-text">
                                                {log.target_account_number || 'N/A'}
                                            </td>
                                            <td>{log.details}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}

            {/* Account Status Transition Modal */}
            {statusModal.isOpen && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-title-group">
                                {statusModal.targetStatus === 'FROZEN' && <Snowflake size={20} color="#0284c7" />}
                                {statusModal.targetStatus === 'ACTIVE' && <Sun size={20} color="#16a34a" />}
                                {statusModal.targetStatus === 'CLOSED' && <Slash size={20} color="#dc2626" />}
                                <h3>
                                    {statusModal.targetStatus === 'FROZEN' && 'Freeze Account'}
                                    {statusModal.targetStatus === 'ACTIVE' && 'Unfreeze Account'}
                                    {statusModal.targetStatus === 'CLOSED' && 'Permanently Close Account'}
                                </h3>
                            </div>
                            <button onClick={closeStatusModal} className="btn-close-modal"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleStatusTransition} className="modal-form">
                            <div className="status-modal-details">
                                <p>Target Account: <strong>{statusModal.account?.account_number}</strong></p>
                                <p>Current Balance: <strong>${parseFloat(statusModal.account?.balance).toFixed(2)}</strong></p>
                                <p>Owner: <strong>{statusModal.account?.full_name}</strong> (@{statusModal.account?.username})</p>
                            </div>

                            {statusModal.targetStatus === 'CLOSED' && parseFloat(statusModal.account?.balance) > 0 && (
                                <div className="alert-error">
                                    <AlertCircle size={16} />
                                    <span>
                                        <strong>Restriction:</strong> This account has an active balance of ${parseFloat(statusModal.account?.balance).toFixed(2)}. An account can only be closed once its balance is strictly $0.00.
                                    </span>
                                </div>
                            )}

                            {statusModal.targetStatus === 'CLOSED' && (
                                <div className="alert-warning-box">
                                    <AlertCircle size={16} color="#d97706" />
                                    <span>
                                        <strong>Terminal State:</strong> Closing an account is irreversible. Once closed, it cannot be reopened or unfrozen.
                                    </span>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Administrative Reason for Change</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Compliance audit, customer request, risk review"
                                    value={statusModal.reason}
                                    onChange={(e) => setStatusModal({ ...statusModal, reason: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={closeStatusModal} className="btn-secondary">
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className={`btn-submit ${statusModal.targetStatus === 'CLOSED' ? 'btn-danger' : ''}`}
                                    disabled={statusModal.targetStatus === 'CLOSED' && parseFloat(statusModal.account?.balance) > 0}
                                >
                                    Confirm Transition to {statusModal.targetStatus}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
