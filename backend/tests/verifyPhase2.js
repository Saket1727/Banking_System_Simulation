const http = require('http');

const BASE_URL = 'http://localhost:5001';

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
    console.log('--- STARTING PHASE 2 AUTOMATED VERIFICATION ---');
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
        // Test 1: Validation Failure - Short password
        console.log('\n[Test 1] Registration Validation (Short Password)');
        const shortPassRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: 'shortpass',
            email: 'short@example.com',
            password: '123',
            fullName: 'Short Pass'
        });
        assert(shortPassRes.statusCode === 400, `Expected 400 Bad Request, got ${shortPassRes.statusCode}`);
        assert(shortPassRes.data.error.includes('8 characters'), 'Error indicates password length requirement');

        // Test 2: Valid Customer Registration
        console.log('\n[Test 2] Valid Customer Registration');
        const testUser = `customer_${Date.now()}`;
        const regRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: testUser,
            email: `${testUser}@test.com`,
            password: 'Password@123',
            fullName: 'Test Customer'
        });
        assert(regRes.statusCode === 201, `Expected 201 Created, got ${regRes.statusCode}`);
        assert(regRes.data.user.role === 'customer', 'Role is strictly customer');
        assert(!!regRes.data.token, 'JWT token returned on registration');
        assert(!!regRes.data.initialAccount, 'Initial simulated checking account automatically provisioned');
        const customerToken = regRes.data.token;

        // Test 3: Privilege Escalation Attack Prevention
        console.log('\n[Test 3] Privilege Escalation Attack Prevention (Sending role: "admin")');
        const hackerUser = `attacker_${Date.now()}`;
        const hackRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: hackerUser,
            email: `${hackerUser}@evil.com`,
            password: 'Password@123',
            fullName: 'Malicious Attacker',
            role: 'admin' // Attempting to escalate!
        });
        assert(hackRes.statusCode === 201, `Registered user, got status ${hackRes.statusCode}`);
        assert(hackRes.data.user.role === 'customer', 'SECURITY CHECK: Escalation blocked! User role is forced to "customer"');

        // Test 4: Duplicate Registration Conflict
        console.log('\n[Test 4] Duplicate Username Conflict');
        const dupRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/register',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            username: testUser,
            email: `another_${testUser}@test.com`,
            password: 'Password@123',
            fullName: 'Duplicate User'
        });
        assert(dupRes.statusCode === 409, `Expected 409 Conflict, got ${dupRes.statusCode}`);

        // Test 5: Customer Login
        console.log('\n[Test 5] Customer Login');
        const loginRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            identifier: testUser,
            password: 'Password@123'
        });
        assert(loginRes.statusCode === 200, `Expected 200 OK, got ${loginRes.statusCode}`);
        assert(loginRes.data.user.username === testUser, 'Returned correct logged in user');
        assert(loginRes.data.user.role === 'customer', 'Returned customer role');

        // Test 6: Invalid Password Login
        console.log('\n[Test 6] Login with Incorrect Password');
        const badLoginRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            identifier: testUser,
            password: 'WrongPassword@123'
        });
        assert(badLoginRes.statusCode === 401, `Expected 401 Unauthorized, got ${badLoginRes.statusCode}`);

        // Test 7: Admin Login with Seeded Credentials
        console.log('\n[Test 7] Admin Login (Seeded account)');
        const adminLoginRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/login',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, {
            identifier: 'admin',
            password: 'Admin@12345'
        });
        assert(adminLoginRes.statusCode === 200, `Expected 200 OK, got ${adminLoginRes.statusCode}`);
        assert(adminLoginRes.data.user.role === 'admin', 'Returned role is admin');
        const adminToken = adminLoginRes.data.token;

        // Test 8: Protected Route (/api/auth/me) without token
        console.log('\n[Test 8] Access Protected Route Without Token');
        const noTokenRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/me',
            method: 'GET'
        });
        assert(noTokenRes.statusCode === 401, `Expected 401 Unauthorized, got ${noTokenRes.statusCode}`);

        // Test 9: Protected Route (/api/auth/me) with Customer Token
        console.log('\n[Test 9] Access Protected Route With Customer Token');
        const meRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/me',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        assert(meRes.statusCode === 200, `Expected 200 OK, got ${meRes.statusCode}`);
        assert(meRes.data.user.username === testUser, 'Profile matches authenticated user');

        // Test 10: RBAC - Customer accessing Customer Area
        console.log('\n[Test 10] RBAC: Customer accessing Customer Route');
        const custAreaRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/customer-area',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        assert(custAreaRes.statusCode === 200, `Expected 200 OK, got ${custAreaRes.statusCode}`);

        // Test 11: RBAC - Customer attempting to access Admin Route (Must be 403 Forbidden)
        console.log('\n[Test 11] RBAC: Customer attempting to access Admin Route');
        const forbiddenRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/admin-area',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        assert(forbiddenRes.statusCode === 403, `Expected 403 Forbidden, got ${forbiddenRes.statusCode}`);
        assert(forbiddenRes.data.error.includes('not authorized'), 'Error explains insufficient role privileges');

        // Test 12: RBAC - Admin accessing Admin Route
        console.log('\n[Test 12] RBAC: Admin accessing Admin Route');
        const adminAreaRes = await request({
            hostname: 'localhost',
            port: 5001,
            path: '/api/auth/admin-area',
            method: 'GET',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        assert(adminAreaRes.statusCode === 200, `Expected 200 OK, got ${adminAreaRes.statusCode}`);

        console.log(`\n===========================================`);
        if (failures === 0) {
            console.log('🎉 ALL 12 PHASE 2 VERIFICATION TESTS PASSED!');
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
