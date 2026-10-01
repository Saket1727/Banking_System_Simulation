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

async function runE2EVerification() {
    console.log('================================================================');
    console.log('🚀 PHASE 6: END-TO-END CONCURRENCY & EDGE-CASE VERIFICATION');
    console.log('================================================================');

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
        // Step 1: Admin Authentication
        console.log('\n[Suite 1] Authenticate Master Admin');
        const adminAuth = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { identifier: 'admin', password: 'Admin@12345' });
        assert(adminAuth.statusCode === 200, 'Admin authenticated');
        const adminToken = adminAuth.data.token;

        // Step 2: Register Two Fresh Test Customers
        console.log('\n[Suite 2] Customer Provisioning & Privilege Escalation Attempt');
        const timestamp = Date.now();
        const custAUsername = `e2e_userA_${timestamp}`;
        const custBUsername = `e2e_userB_${timestamp}`;

        // Attempt privilege escalation during registration
        const regARes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: custAUsername,
            email: `${custAUsername}@test.com`,
            password: 'Password@123',
            fullName: 'E2E Customer Alpha',
            role: 'admin' // Injection attempt!
        });
        assert(regARes.statusCode === 201, 'Customer Alpha created');
        assert(regARes.data.user.role === 'customer', 'Role injection blocked! Customer Alpha role is customer');
        const tokenA = regARes.data.token;
        const userA = regARes.data.user;

        const regBRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: custBUsername,
            email: `${custBUsername}@test.com`,
            password: 'Password@123',
            fullName: 'E2E Customer Beta'
        });
        assert(regBRes.statusCode === 201, 'Customer Beta created');
        const tokenB = regBRes.data.token;
        const userB = regBRes.data.user;

        // Fetch accounts
        const accARes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/accounts/my-accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        const accountA = accARes.data.accounts[0];
        assert(parseFloat(accountA.balance) === 1000.00, 'Customer A initial balance is $1,000.00');

        const accBRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/accounts/my-accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });
        const accountB = accBRes.data.accounts[0];
        assert(parseFloat(accountB.balance) === 1000.00, 'Customer B initial balance is $1,000.00');

        // Step 3: CONCURRENCY TEST - Double-Spending Defense (Pessimistic Row Locking)
        console.log('\n[Suite 3] Concurrency Test: 5 Simultaneous Withdrawals (Double-Spending Defense)');
        console.log('Account A starting balance: $1,000.00');
        console.log('Dispatching 5 parallel withdrawal requests of $400.00 each (Total attempted: $2,000.00)...');

        const concurrentWithdrawals = Array.from({ length: 5 }, (_, i) => {
            return request({
                hostname: 'localhost',
                port: PORT,
                path: '/api/transactions/withdraw',
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${tokenA}`,
                    'Content-Type': 'application/json'
                }
            }, {
                accountId: accountA.id,
                amount: 400.00,
                description: `Concurrent withdrawal thread #${i + 1}`
            });
        });

        const withdrawalResults = await Promise.all(concurrentWithdrawals);

        const successfulWithdrawals = withdrawalResults.filter(r => r.statusCode === 200);
        const rejectedWithdrawals = withdrawalResults.filter(r => r.statusCode === 400);

        console.log(`Results: ${successfulWithdrawals.length} succeeded, ${rejectedWithdrawals.length} rejected.`);
        assert(successfulWithdrawals.length === 2, 'Exactly 2 withdrawals of $400 succeeded ($800 total debited)');
        assert(rejectedWithdrawals.length === 3, 'Exactly 3 withdrawals rejected due to Insufficient Funds');

        // Check Account A balance after concurrent withdrawals
        const accAPostWithdraw = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/accounts/my-accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        const balancePostWithdraw = parseFloat(accAPostWithdraw.data.accounts[0].balance);
        assert(balancePostWithdraw === 200.00, `Account A final balance is exactly $200.00 (Math: 1000 - 400 - 400 = 200)`);

        // Step 4: CONCURRENCY TEST - Bi-directional Cross-Transfers (Deadlock Freedom)
        console.log('\n[Suite 4] Concurrency Test: Simultaneous Cross-Transfers (Deadlock Freedom)');
        console.log('Thread 1: Customer A transfers $50 to Customer B');
        console.log('Thread 2: Customer B transfers $100 to Customer A');

        const crossTransfer1 = request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/transfer',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' }
        }, {
            sourceAccountId: accountA.id,
            destinationAccountNumber: accountB.account_number,
            amount: 50.00,
            description: 'Cross transfer A -> B'
        });

        const crossTransfer2 = request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/transfer',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' }
        }, {
            sourceAccountId: accountB.id,
            destinationAccountNumber: accountA.account_number,
            amount: 100.00,
            description: 'Cross transfer B -> A'
        });

        const [crossRes1, crossRes2] = await Promise.all([crossTransfer1, crossTransfer2]);
        assert(crossRes1.statusCode === 200, 'Cross transfer A -> B completed without deadlock');
        assert(crossRes2.statusCode === 200, 'Cross transfer B -> A completed without deadlock');

        // Verify balances after cross transfers
        // A was 200 - 50 + 100 = 250
        // B was 1000 + 50 - 100 = 950
        const accAFinal = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/accounts/my-accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        const accBFinal = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/accounts/my-accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenB}` }
        });

        const finalBalA = parseFloat(accAFinal.data.accounts[0].balance);
        const finalBalB = parseFloat(accBFinal.data.accounts[0].balance);
        assert(finalBalA === 250.00, `Customer A balance verified: $${finalBalA} (Expected $250.00)`);
        assert(finalBalB === 950.00, `Customer B balance verified: $${finalBalB} (Expected $950.00)`);
        assert(finalBalA + finalBalB === 1200.00, 'Conservation of simulated funds verified: $1200.00 total');

        // Step 5: Full Account Lifecycle & Invariants
        console.log('\n[Suite 5] Full Lifecycle State Machine (ACTIVE -> FROZEN -> ACTIVE -> CLOSED)');
        
        // 5a. Freeze Account B
        const freezeRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${accountB.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { status: 'FROZEN', reason: 'E2E Freeze Test' });
        assert(freezeRes.statusCode === 200, 'Admin froze Account B');

        // 5b. Operations on Frozen Account must fail
        const frozenDepRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/deposit',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' }
        }, { accountId: accountB.id, amount: 100.00 });
        assert(frozenDepRes.statusCode === 400, 'Deposit to FROZEN account rejected (400)');

        const frozenTrfRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/transfer',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenA}`, 'Content-Type': 'application/json' }
        }, {
            sourceAccountId: accountA.id,
            destinationAccountNumber: accountB.account_number,
            amount: 50.00
        });
        assert(frozenTrfRes.statusCode === 400, 'Transfer to FROZEN destination account rejected (400)');

        // 5c. Unfreeze Account B
        const unfreezeRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${accountB.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { status: 'ACTIVE', reason: 'E2E Unfreeze Test' });
        assert(unfreezeRes.statusCode === 200, 'Admin unfroze Account B');

        // 5d. Cannot close account with balance > $0
        const badCloseRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${accountB.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { status: 'CLOSED', reason: 'Closure test' });
        assert(badCloseRes.statusCode === 400, 'Close attempt with non-zero balance rejected (400)');

        // 5e. Liquidate Account B to $0.00 and close
        const liquidateRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/withdraw',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${tokenB}`, 'Content-Type': 'application/json' }
        }, { accountId: accountB.id, amount: finalBalB });
        assert(liquidateRes.statusCode === 200, 'Account B balance fully liquidated to $0.00');

        const goodCloseRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${accountB.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { status: 'CLOSED', reason: 'Account successfully liquidated' });
        assert(goodCloseRes.statusCode === 200, 'Account B successfully closed');

        // 5f. Attempt to reopen closed account must fail
        const reopenRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: `/api/admin/accounts/${accountB.id}/status`,
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${adminToken}`, 'Content-Type': 'application/json' }
        }, { status: 'ACTIVE' });
        assert(reopenRes.statusCode === 400, 'Reopening permanently closed account rejected (400)');

        // Step 6: Ledger Audit Reconciliation
        console.log('\n[Suite 6] Ledger Double-Entry Audit Reconciliation');
        const historyA = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/history',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${tokenA}` }
        });
        assert(historyA.statusCode === 200, 'Fetched Account A ledger history');
        assert(historyA.data.transactions.length >= 4, 'Found all ledger entries for Customer A');

        // Calculate reconciled sum:
        // Welcome Deposit: +1000
        // Concurrency Withdrawals: -400, -400
        // Cross Transfer Out: -50
        // Cross Transfer In: +100
        // Expected total: 250.00
        let reconciledBalance = 0;
        for (const tx of historyA.data.transactions) {
            const amt = parseFloat(tx.amount);
            if (tx.transaction_type === 'DEPOSIT') {
                reconciledBalance += amt;
            } else if (tx.transaction_type === 'WITHDRAWAL') {
                reconciledBalance -= amt;
            } else if (tx.transaction_type === 'TRANSFER') {
                if (tx.destination_account_number === accountA.account_number) {
                    reconciledBalance += amt;
                } else if (tx.source_account_number === accountA.account_number) {
                    reconciledBalance -= amt;
                }
            }
        }
        assert(reconciledBalance === 250.00, `Ledger audit reconciled perfectly: $${reconciledBalance.toFixed(2)} === $250.00`);

        console.log('\n================================================================');
        if (failures === 0) {
            console.log('🏆 ALL 22 E2E CONCURRENCY & EDGE-CASE VERIFICATION TESTS PASSED!');
        } else {
            console.error(`💥 ${failures} E2E TESTS FAILED!`);
            process.exit(1);
        }
        console.log('================================================================\n');
    } catch (err) {
        console.error('Fatal E2E error:', err);
        process.exit(1);
    }
}

runE2EVerification();
