import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { accountAPI, transactionAPI } from '../services/api';
import { 
    Wallet, 
    ArrowDownRight, 
    ArrowUpRight, 
    ArrowRightLeft, 
    PlusCircle, 
    MinusCircle, 
    Send, 
    RefreshCw, 
    AlertCircle, 
    CheckCircle2, 
    Clock,
    X,
    ShieldAlert
} from 'lucide-react';

export default function CustomerDashboard() {
    const { user } = useAuth();
    const [accounts, setAccounts] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', message: '' });
    const [activeTab, setActiveTab] = useState('ALL');

    // Modal state
    const [modalType, setModalType] = useState(null); // 'DEPOSIT', 'WITHDRAW', 'TRANSFER'
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [amount, setAmount] = useState('');
    const [destAccountNum, setDestAccountNum] = useState('');
    const [note, setNote] = useState('');

    const fetchData = async () => {
        setLoading(true);
        try {
            const [accRes, txRes] = await Promise.all([
                accountAPI.getMyAccounts(),
                transactionAPI.getHistory({ limit: 50 })
            ]);

            if (accRes.success) {
                setAccounts(accRes.accounts);
                if (accRes.accounts.length > 0 && !selectedAccountId) {
                    setSelectedAccountId(accRes.accounts[0].id);
                }
            }

            if (txRes.success) {
                setTransactions(txRes.transactions);
            }
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Failed to load banking data.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openModal = (type, defaultAccId = null) => {
        setModalType(type);
        setAmount('');
        setDestAccountNum('');
        setNote('');
        setFeedback({ type: '', message: '' });
        if (defaultAccId) {
            setSelectedAccountId(defaultAccId);
        } else if (accounts.length > 0) {
            setSelectedAccountId(accounts[0].id);
        }
    };

    const closeModal = () => {
        setModalType(null);
    };

    const handleTransactionSubmit = async (e) => {
        e.preventDefault();
        setActionLoading(true);
        setFeedback({ type: '', message: '' });

        try {
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
                throw new Error('Please enter a valid amount greater than 0.');
            }

            if (modalType === 'DEPOSIT') {
                const res = await transactionAPI.deposit(selectedAccountId, numAmount, note);
                setFeedback({ type: 'success', message: res.message });
            } else if (modalType === 'WITHDRAW') {
                const res = await transactionAPI.withdraw(selectedAccountId, numAmount, note);
                setFeedback({ type: 'success', message: res.message });
            } else if (modalType === 'TRANSFER') {
                if (!destAccountNum.trim()) {
                    throw new Error('Destination account number is required.');
                }
                const res = await transactionAPI.transfer(selectedAccountId, destAccountNum.trim(), numAmount, note);
                setFeedback({ type: 'success', message: res.message });
            }

            closeModal();
            await fetchData();
        } catch (err) {
            setFeedback({ type: 'error', message: err.message || 'Operation failed.' });
        } finally {
            setActionLoading(false);
        }
    };

    const totalSimulatedBalance = accounts.reduce((acc, a) => acc + parseFloat(a.balance || 0), 0);
    const selectedAccountObj = accounts.find(a => a.id === parseInt(selectedAccountId, 10)) || accounts[0];

    const filteredTransactions = transactions.filter(tx => {
        if (activeTab === 'ALL') return true;
        return tx.transaction_type === activeTab;
    });

    return (
        <div className="dashboard-container">
            {/* Header Greeting & Controls */}
            <div className="dashboard-header">
                <div>
                    <h1>Welcome back, {user?.fullName || user?.username}</h1>
                    <p className="subtitle">Simulated Customer Online Banking Portal</p>
                </div>
                <div className="header-actions">
                    <button onClick={fetchData} className="btn-refresh" title="Refresh balances">
                        <RefreshCw size={16} />
                        <span>Refresh</span>
                    </button>
                    <button onClick={() => openModal('DEPOSIT')} className="btn-action deposit">
                        <PlusCircle size={16} />
                        <span>Deposit</span>
                    </button>
                    <button onClick={() => openModal('WITHDRAW')} className="btn-action withdraw">
                        <MinusCircle size={16} />
                        <span>Withdraw</span>
                    </button>
                    <button onClick={() => openModal('TRANSFER')} className="btn-action transfer">
                        <Send size={16} />
                        <span>Transfer</span>
                    </button>
                </div>
            </div>

            {/* Global Alert Notification */}
            {feedback.message && (
                <div className={`alert-banner ${feedback.type === 'error' ? 'alert-error' : 'alert-success'}`}>
                    {feedback.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
                    <span>{feedback.message}</span>
                    <button onClick={() => setFeedback({ type: '', message: '' })} className="alert-close"><X size={14} /></button>
                </div>
            )}

            {/* Net Worth Summary Card */}
            <div className="metrics-row">
                <div className="metric-card primary-gradient">
                    <div className="metric-header">
                        <span className="metric-title">Total Simulated Net Worth</span>
                        <Wallet size={20} />
                    </div>
                    <div className="metric-value">${totalSimulatedBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="metric-footer">Across {accounts.length} simulated account{accounts.length === 1 ? '' : 's'}</div>
                </div>
            </div>

            {/* Simulated Accounts Grid */}
            <section className="section-block">
                <div className="section-header">
                    <h2>Your Bank Accounts</h2>
                    <span className="badge-count">{accounts.length} Active</span>
                </div>

                {loading ? (
                    <div className="loading-state">Loading your accounts...</div>
                ) : accounts.length === 0 ? (
                    <div className="empty-state">No simulated accounts found.</div>
                ) : (
                    <div className="accounts-grid">
                        {accounts.map(acc => (
                            <div key={acc.id} className={`account-card ${acc.status.toLowerCase()}`}>
                                <div className="account-top">
                                    <span className="account-type-tag">{acc.account_type}</span>
                                    <span className={`status-pill status-${acc.status.toLowerCase()}`}>
                                        {acc.status}
                                    </span>
                                </div>
                                <div className="account-number">{acc.account_number}</div>
                                <div className="account-balance">
                                    ${parseFloat(acc.balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>

                                {acc.status === 'FROZEN' && (
                                    <div className="account-warning">
                                        <ShieldAlert size={14} />
                                        <span>Account is temporarily frozen by administration.</span>
                                    </div>
                                )}

                                <div className="account-actions">
                                    <button 
                                        disabled={acc.status !== 'ACTIVE'} 
                                        onClick={() => openModal('DEPOSIT', acc.id)} 
                                        className="btn-card-action"
                                    >
                                        Deposit
                                    </button>
                                    <button 
                                        disabled={acc.status !== 'ACTIVE'} 
                                        onClick={() => openModal('WITHDRAW', acc.id)} 
                                        className="btn-card-action"
                                    >
                                        Withdraw
                                    </button>
                                    <button 
                                        disabled={acc.status !== 'ACTIVE'} 
                                        onClick={() => openModal('TRANSFER', acc.id)} 
                                        className="btn-card-action highlight"
                                    >
                                        Transfer
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Filterable Transaction History Ledger */}
            <section className="section-block">
                <div className="section-header ledger-header">
                    <div>
                        <h2>Transaction History</h2>
                        <p className="subtitle">Real-time simulated ledger entries</p>
                    </div>

                    <div className="filter-tabs">
                        {['ALL', 'DEPOSIT', 'WITHDRAWAL', 'TRANSFER'].map(tab => (
                            <button
                                key={tab}
                                className={`filter-tab ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="table-wrapper">
                    <table className="ledger-table">
                        <thead>
                            <tr>
                                <th>Date & Time</th>
                                <th>Reference</th>
                                <th>Type</th>
                                <th>Details / Note</th>
                                <th>Accounts Involved</th>
                                <th className="text-right">Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="empty-row">No transaction records match the current filter.</td>
                                </tr>
                            ) : (
                                filteredTransactions.map(tx => {
                                    const isDeposit = tx.transaction_type === 'DEPOSIT';
                                    const isWithdrawal = tx.transaction_type === 'WITHDRAWAL';
                                    const isTransfer = tx.transaction_type === 'TRANSFER';

                                    return (
                                        <tr key={tx.id}>
                                            <td className="text-muted">
                                                <div className="cell-datetime">
                                                    <Clock size={12} />
                                                    <span>{new Date(tx.created_at).toLocaleString()}</span>
                                                </div>
                                            </td>
                                            <td className="code-text">{tx.reference_id}</td>
                                            <td>
                                                <span className={`type-badge badge-${tx.transaction_type.toLowerCase()}`}>
                                                    {isDeposit && <ArrowDownRight size={13} />}
                                                    {isWithdrawal && <ArrowUpRight size={13} />}
                                                    {isTransfer && <ArrowRightLeft size={13} />}
                                                    {tx.transaction_type}
                                                </span>
                                            </td>
                                            <td>{tx.description || '—'}</td>
                                            <td className="account-flow">
                                                {tx.source_account_number ? (
                                                    <span className="acc-flow-tag">{tx.source_account_number}</span>
                                                ) : <span className="acc-flow-na">External Simulator</span>}
                                                <span className="arrow-sep">→</span>
                                                {tx.destination_account_number ? (
                                                    <span className="acc-flow-tag">{tx.destination_account_number}</span>
                                                ) : <span className="acc-flow-na">External Simulator</span>}
                                            </td>
                                            <td className={`text-right font-mono font-bold ${isDeposit ? 'amount-positive' : 'amount-negative'}`}>
                                                {isDeposit ? '+' : '-'}${parseFloat(tx.amount).toFixed(2)}
                                            </td>
                                            <td>
                                                <span className="status-tag status-completed">
                                                    {tx.status}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Modal Dialog for Deposit, Withdraw, Transfer */}
            {modalType && (
                <div className="modal-backdrop">
                    <div className="modal-card">
                        <div className="modal-header">
                            <div className="modal-title-group">
                                {modalType === 'DEPOSIT' && <PlusCircle size={20} color="#16a34a" />}
                                {modalType === 'WITHDRAW' && <MinusCircle size={20} color="#dc2626" />}
                                {modalType === 'TRANSFER' && <Send size={20} color="#2563eb" />}
                                <h3>
                                    {modalType === 'DEPOSIT' && 'Simulate Deposit'}
                                    {modalType === 'WITHDRAW' && 'Simulate Withdrawal'}
                                    {modalType === 'TRANSFER' && 'Simulate Inter-Account Transfer'}
                                </h3>
                            </div>
                            <button onClick={closeModal} className="btn-close-modal"><X size={18} /></button>
                        </div>

                        <form onSubmit={handleTransactionSubmit} className="modal-form">
                            <div className="form-group">
                                <label>
                                    {modalType === 'TRANSFER' ? 'Source Account' : 'Target Account'}
                                </label>
                                <select 
                                    value={selectedAccountId} 
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                    required
                                >
                                    {accounts.map(acc => (
                                        <option key={acc.id} value={acc.id} disabled={acc.status !== 'ACTIVE'}>
                                            {acc.account_number} ({acc.account_type}) — Balance: ${parseFloat(acc.balance).toFixed(2)} {acc.status !== 'ACTIVE' ? `[${acc.status}]` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {modalType === 'TRANSFER' && (
                                <div className="form-group">
                                    <label>Destination Account Number</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. ACC-2001 or another customer account"
                                        value={destAccountNum}
                                        onChange={(e) => setDestAccountNum(e.target.value)}
                                        required
                                    />
                                    <small className="hint">Tip for testing: Transfer simulated funds to Jane Smith's demo account: <code>ACC-2001</code></small>
                                </div>
                            )}

                            <div className="form-group">
                                <label>Simulated Amount ($ USD)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    min="0.01" 
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    required
                                />
                                {modalType === 'WITHDRAW' && selectedAccountObj && (
                                    <small className="hint">Available balance: <strong>${parseFloat(selectedAccountObj.balance).toFixed(2)}</strong></small>
                                )}
                            </div>

                            <div className="form-group">
                                <label>Description / Note (Optional)</label>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Monthly rent, savings goal"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" onClick={closeModal} className="btn-secondary">
                                    Cancel
                                </button>
                                <button type="submit" className="btn-submit" disabled={actionLoading}>
                                    {actionLoading ? 'Processing...' : `Confirm ${modalType}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
