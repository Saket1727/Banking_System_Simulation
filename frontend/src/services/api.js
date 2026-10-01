const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Universal HTTP client with automatic JWT token attachment
 */
async function apiRequest(endpoint, options = {}) {
    const token = localStorage.getItem('banksim_token');
    
    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...options.headers
    };

    const config = {
        ...options,
        headers
    };

    if (config.body && typeof config.body === 'object') {
        config.body = JSON.stringify(config.body);
    }

    const response = await fetch(`${BASE_URL}${endpoint}`, config);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
        // Auto-clear invalid token on 401
        if (response.status === 401 && token) {
            localStorage.removeItem('banksim_token');
            localStorage.removeItem('banksim_user');
            window.location.href = '/login';
        }

        const error = new Error(data.error || 'Network request failed.');
        error.status = response.status;
        error.data = data;
        throw error;
    }

    return data;
}

// Authentication Service
export const authAPI = {
    login: (identifier, password) => apiRequest('/auth/login', {
        method: 'POST',
        body: { identifier, password }
    }),
    register: (payload) => apiRequest('/auth/register', {
        method: 'POST',
        body: payload
    }),
    getMe: () => apiRequest('/auth/me', {
        method: 'GET'
    })
};

// Customer Account Service
export const accountAPI = {
    getMyAccounts: () => apiRequest('/accounts/my-accounts', {
        method: 'GET'
    }),
    getAccountDetails: (id) => apiRequest(`/accounts/${id}`, {
        method: 'GET'
    })
};

// Transactions Service
export const transactionAPI = {
    deposit: (accountId, amount, description) => apiRequest('/transactions/deposit', {
        method: 'POST',
        body: { accountId, amount, description }
    }),
    withdraw: (accountId, amount, description) => apiRequest('/transactions/withdraw', {
        method: 'POST',
        body: { accountId, amount, description }
    }),
    transfer: (sourceAccountId, destinationAccountNumber, amount, description) => apiRequest('/transactions/transfer', {
        method: 'POST',
        body: { sourceAccountId, destinationAccountNumber, amount, description }
    }),
    getHistory: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/transactions/history${query ? `?${query}` : ''}`, {
            method: 'GET'
        });
    }
};

// Administrative Operations Service
export const adminAPI = {
    getAllUsers: (role) => apiRequest(`/admin/users${role ? `?role=${role}` : ''}`, {
        method: 'GET'
    }),
    getAllAccounts: (filters = {}) => {
        const query = new URLSearchParams(filters).toString();
        return apiRequest(`/admin/accounts${query ? `?${query}` : ''}`, {
            method: 'GET'
        });
    },
    createAccount: (userId, accountType, initialBalance) => apiRequest('/admin/accounts', {
        method: 'POST',
        body: { userId, accountType, initialBalance }
    }),
    updateAccountStatus: (accountId, status, reason) => apiRequest(`/admin/accounts/${accountId}/status`, {
        method: 'PATCH',
        body: { status, reason }
    }),
    getAuditLogs: (params = {}) => {
        const query = new URLSearchParams(params).toString();
        return apiRequest(`/admin/audit-logs${query ? `?${query}` : ''}`, {
            method: 'GET'
        });
    }
};
