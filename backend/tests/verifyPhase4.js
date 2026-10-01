const http = require('http');

const PORT = 5001;

function request(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {
                    parsed = body;
                }
                resolve({ statusCode: res.statusCode, headers: res.headers, data: parsed });
            });
        });

        req.on('error', reject);

        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

async function runTests() {
    console.log('--- STARTING PHASE 4 AUTOMATED VERIFICATION ---');
    let failures = 0;

    function assert(condition, message) {
        if (condition) {
            console.log(`✅ PASS: ${message}`);
        } else {
            console.error(`❌ FAIL: ${message}`);
            failures++;
        }
    }

    try {
        // Step 1: Authenticate Admin & Customer
        console.log('\n[Step 1] Authenticate Admin & Customer');
        const adminLogin = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { identifier: 'admin', password: 'Admin@12345' });
        assert(adminLogin.statusCode === 200, 'Admin authenticated successfully');
        const adminToken = adminLogin.data.token;

        const customerLogin = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { identifier: 'jane_smith', password: 'Customer@12345' });
        assert(customerLogin.statusCode === 200, 'Customer authenticated successfully');
        const customerToken = customerLogin.data.token;
        const janeUserId = customerLogin.data.user.id;

        // Step 2: RBAC Barrier Verification
        console.log('\n[Step 2] RBAC Barrier Check (Customer attempting admin endpoints)');
        const unauthUsersRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/admin/users',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        assert(unauthUsersRes.statusCode === 403, 'Customer blocked from GET /api/admin/users (403)');

        const unauthAccountsRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/admin/accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        assert(unauthAccountsRes.statusCode === 403, 'Customer blocked from GET /api/admin/accounts (403)');

        // Step 3: Admin List Users & Accounts
        console.log('\n[Step 3] Admin Directory Queries (Users & Accounts)');
        const usersListRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/admin/users',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert(usersListRes.statusCode === 200, 'Admin successfully listed all users');
        assert(usersListRes.data.users.length >= 3, 'Found all system users');

        const accountsListRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/admin/accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert(accountsListRes.statusCode === 200, 'Admin successfully listed all accounts');
        assert(accountsListRes.data.accounts.length >= 3, 'Found all system accounts');

        // Step 4: Admin Creates Customer Account
        console.log('\n[Step 4] Admin Provisions New Savings Account for Customer');
        const newAccRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/admin/accounts',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, {
            userId: janeUserId,
            accountType: 'SAVINGS',
            initialBalance: 1500.00
        });
        assert(newAccRes.statusCode === 201, 'Account creation succeeded (201 Created)');
        assert(newAccRes.data.account.accountType === 'SAVINGS', 'Account type is SAVINGS');
        assert(newAccRes.data.account.balance === 1500.00, 'Initial balance is $1500.00');
        const createdAccount = newAccRes.data.account;

        // Step 5: Freeze Account
        console.log('\n[Step 5] Admin Freezes Account');
        const freezeRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${createdAccount.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, {
            status: 'FROZEN',
            reason: 'Suspicious simulated activity review'
        });
        assert(freezeRes.statusCode === 200, 'Account freeze request returned 200 OK');
        assert(freezeRes.data.account.status === 'FROZEN', 'Account status confirmed FROZEN');

        // Step 6: Operation Rejection on Frozen Account
        console.log('\n[Step 6] Enforce Invariants on Frozen Account');
        const frozenWithdrawRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/withdraw',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' }
        }, { accountId: createdAccount.id, amount: 100.00 });
        assert(frozenWithdrawRes.statusCode === 400, 'Withdrawal from FROZEN account rejected (400)');
        assert(frozenWithdrawRes.data.error.includes('FROZEN'), 'Error explains account is FROZEN');

        const frozenDepositRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/deposit',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' }
        }, { accountId: createdAccount.id, amount: 100.00 });
        assert(frozenDepositRes.statusCode === 400, 'Deposit to FROZEN account rejected (400)');

        // Step 7: Unfreeze Account
        console.log('\n[Step 7] Admin Unfreezes Account');
        const unfreezeRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${createdAccount.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, {
            status: 'ACTIVE',
            reason: 'Security verification cleared'
        });
        assert(unfreezeRes.statusCode === 200, 'Account unfreeze returned 200 OK');
        assert(unfreezeRes.data.account.status === 'ACTIVE', 'Account status confirmed ACTIVE');

        // Step 8: Close Account With Non-Zero Balance (Must Fail)
        console.log('\n[Step 8] Attempt to Close Account with Non-Zero Balance (Must Fail)');
        const badCloseRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${createdAccount.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, {
            status: 'CLOSED',
            reason: 'Customer requested closure'
        });
        assert(badCloseRes.statusCode === 400, 'Premature closure rejected with 400 Bad Request');
        assert(badCloseRes.data.error.includes('must be strictly $0.00'), 'Error explains balance must be $0.00');

        // Step 9: Liquidate Balance & Successfully Close Account
        console.log('\n[Step 9] Liquidate Remaining Balance and Close Account');
        const liquidateRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/withdraw',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${customerToken}`, 'Content-Type': 'application/json' }
        }, { accountId: createdAccount.id, amount: 1500.00, description: 'Closing liquidation' });
        assert(liquidateRes.statusCode === 200, 'Full balance withdrawn to 0.00');
        assert(liquidateRes.data.newBalance === 0.00, 'Balance is confirmed 0.00');

        const goodCloseRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${createdAccount.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, {
            status: 'CLOSED',
            reason: 'Customer closure finalized'
        });
        assert(goodCloseRes.statusCode === 200, 'Account successfully CLOSED (200 OK)');
        assert(goodCloseRes.data.account.status === 'CLOSED', 'Account status confirmed CLOSED');

        // Step 10: Closed Account is Terminal
        console.log('\n[Step 10] Terminal State Check (Cannot reopen a closed account)');
        const reopenRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${createdAccount.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { status: 'ACTIVE' });
        assert(reopenRes.statusCode === 400, 'Reopening closed account blocked (400)');
        assert(reopenRes.data.error.includes('permanently CLOSED'), 'Error confirms terminal state');

        // Step 11: Audit Logs Query
        console.log('\n[Step 11] Inspect Administrative Audit Logs');
        const auditRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/admin/audit-logs',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert(auditRes.statusCode === 200, 'Audit logs retrieved');
        assert(auditRes.data.logs.length >= 4, 'Recorded at least 4 administrative audit entries');
        const actions = auditRes.data.logs.map(l => l.action);
        assert(actions.includes('ACCOUNT_CREATED'), 'ACCOUNT_CREATED action in audit log');
        assert(actions.includes('ACCOUNT_FROZEN'), 'ACCOUNT_FROZEN action in audit log');
        assert(actions.includes('ACCOUNT_UNFROZEN'), 'ACCOUNT_UNFROZEN action in audit log');
        assert(actions.includes('ACCOUNT_CLOSED'), 'ACCOUNT_CLOSED action in audit log');

        console.log(`\n===========================================`);
        if (failures === 0) {
            console.log('🎉 ALL 20 PHASE 4 VERIFICATION TESTS PASSED!');
        } else {
            console.error(`💥 ${failures} TESTS FAILED!`);
            process.exit(1);
        }
        console.log(`===========================================\n`);
    } catch (err) {
        console.error('Test execution error:', err);
        process.exit(1);
    }
}

runTests();
