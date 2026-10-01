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
    console.log('--- STARTING PHASE 3 AUTOMATED VERIFICATION ---');
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
        // Step 1: Login as John Doe
        console.log('\n[Step 1] Authenticate John Doe & Jane Smith');
        const johnLogin = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { identifier: 'john_doe', password: 'Customer@12345' });
        assert(johnLogin.statusCode === 200, 'John Doe authenticated');
        const johnToken = johnLogin.data.token;

        const janeLogin = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { identifier: 'jane_smith', password: 'Customer@12345' });
        assert(janeLogin.statusCode === 200, 'Jane Smith authenticated');
        const janeToken = janeLogin.data.token;

        // Step 2: Fetch John's Accounts
        console.log('\n[Step 2] Fetch Customer Accounts (GET /api/accounts/my-accounts)');
        const johnAccountsRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/accounts/my-accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${johnToken}` }
        });
        assert(johnAccountsRes.statusCode === 200, 'Fetched John accounts');
        assert(johnAccountsRes.data.accounts.length >= 2, 'Found at least 2 accounts for John');
        const johnChecking = johnAccountsRes.data.accounts.find(a => a.account_type === 'CHECKING');
        assert(!!johnChecking, `Found John checking account: ${johnChecking.account_number}`);
        const startBalance = parseFloat(johnChecking.balance);

        const janeAccountsRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/accounts/my-accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${janeToken}` }
        });
        const janeChecking = janeAccountsRes.data.accounts[0];
        assert(!!janeChecking, `Found Jane checking account: ${janeChecking.account_number}`);
        const janeStartBalance = parseFloat(janeChecking.balance);

        // Step 3: Deposit Simulation
        console.log('\n[Step 3] Simulate Deposit (POST /api/transactions/deposit)');
        const depositAmount = 500.00;
        const depRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/deposit',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${johnToken}`,
                'Content-Type': 'application/json'
            }
        }, {
            accountId: johnChecking.id,
            amount: depositAmount,
            description: 'Test Payroll Deposit'
        });
        assert(depRes.statusCode === 200, 'Deposit request accepted');
        assert(depRes.data.newBalance === startBalance + depositAmount, `Balance correctly incremented to ${startBalance + depositAmount}`);
        assert(depRes.data.transaction.type === 'DEPOSIT', 'Ledger type is DEPOSIT');

        // Step 4: Invalid Deposit (Negative & Limit)
        console.log('\n[Step 4] Validate Deposit Bounds');
        const negDepRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/deposit',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${johnToken}`, 'Content-Type': 'application/json' }
        }, { accountId: johnChecking.id, amount: -50 });
        assert(negDepRes.statusCode === 400, 'Negative deposit rejected (400)');

        // Step 5: Withdrawal Simulation
        console.log('\n[Step 5] Simulate Withdrawal (POST /api/transactions/withdraw)');
        const withdrawAmount = 200.00;
        const currentBalance = depRes.data.newBalance;
        const wthRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/withdraw',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${johnToken}`,
                'Content-Type': 'application/json'
            }
        }, {
            accountId: johnChecking.id,
            amount: withdrawAmount,
            description: 'ATM Cash Withdrawal'
        });
        assert(wthRes.statusCode === 200, 'Withdrawal request accepted');
        assert(wthRes.data.newBalance === currentBalance - withdrawAmount, `Balance correctly debited to ${currentBalance - withdrawAmount}`);

        // Step 6: Overdraft Prevention
        console.log('\n[Step 6] Overdraft Protection');
        const overWthRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/withdraw',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${johnToken}`, 'Content-Type': 'application/json' }
        }, { accountId: johnChecking.id, amount: 9999999 });
        assert(overWthRes.statusCode === 400, 'Overdraft rejected with 400 Bad Request');
        assert(overWthRes.data.error.includes('Insufficient funds'), 'Error specifies Insufficient funds');

        // Step 7: Unauthorized Account Access
        console.log('\n[Step 7] Unauthorized Account Operation (John attempting to withdraw from Jane)');
        const unauthWthRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/withdraw',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${johnToken}`, 'Content-Type': 'application/json' }
        }, { accountId: janeChecking.id, amount: 50 });
        assert(unauthWthRes.statusCode === 403, 'Unauthorized withdrawal blocked with 403 Forbidden');

        // Step 8: Inter-account Transfer Simulation
        console.log('\n[Step 8] Inter-Account Transfer (John -> Jane)');
        const transferAmount = 300.00;
        const balanceBeforeTransfer = wthRes.data.newBalance;
        const trfRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/transfer',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${johnToken}`,
                'Content-Type': 'application/json'
            }
        }, {
            sourceAccountId: johnChecking.id,
            destinationAccountNumber: janeChecking.account_number,
            amount: transferAmount,
            description: 'Rent reimbursement'
        });
        assert(trfRes.statusCode === 200, 'Transfer request succeeded');
        assert(trfRes.data.sourceNewBalance === balanceBeforeTransfer - transferAmount, 'Source balance debited');

        // Verify Jane's account was credited
        const janeUpdated = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/accounts/my-accounts',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${janeToken}` }
        });
        const janeNewBal = parseFloat(janeUpdated.data.accounts[0].balance);
        assert(janeNewBal === janeStartBalance + transferAmount, `Destination account credited from ${janeStartBalance} to ${janeNewBal}`);

        // Step 9: Transfer Validation - Self Transfer and Non-existent Account
        console.log('\n[Step 9] Transfer Edge Cases');
        const selfTrfRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/transfer',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${johnToken}`, 'Content-Type': 'application/json' }
        }, {
            sourceAccountId: johnChecking.id,
            destinationAccountNumber: johnChecking.account_number,
            amount: 50
        });
        assert(selfTrfRes.statusCode === 400, 'Self transfer blocked (400)');

        const notFoundTrfRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/transfer',
            method: 'POST',
            headers: { 'Authorization': `Bearer ${johnToken}`, 'Content-Type': 'application/json' }
        }, {
            sourceAccountId: johnChecking.id,
            destinationAccountNumber: 'ACC-NONEXISTENT',
            amount: 50
        });
        assert(notFoundTrfRes.statusCode === 404, 'Transfer to non-existent account returned 404 Not Found');

        // Step 10: Transaction History Ledger
        console.log('\n[Step 10] Transaction Ledger History (GET /api/transactions/history)');
        const historyRes = await request({
            hostname: 'localhost',
            port: PORT,
            path: '/api/transactions/history',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${johnToken}` }
        });
        assert(historyRes.statusCode === 200, 'Ledger history retrieved');
        assert(historyRes.data.transactions.length >= 3, 'Found recorded transactions');
        assert(!!historyRes.data.pagination, 'Pagination metadata included');

        const latestTx = historyRes.data.transactions[0];
        assert(latestTx.transaction_type === 'TRANSFER', 'Latest transaction is TRANSFER');
        assert(latestTx.source_account_number === johnChecking.account_number, 'Source account number logged');
        assert(latestTx.destination_account_number === janeChecking.account_number, 'Destination account number logged');

        console.log(`\n===========================================`);
        if (failures === 0) {
            console.log('🎉 ALL 18 PHASE 3 VERIFICATION TESTS PASSED!');
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
