// Local testing script - run with: npx tsx test-local.ts
import 'dotenv/config';

const BASE_URL = process.env.TEST_URL || 'http://localhost:10000';
const API_KEY = process.env.API_KEY || 'changeme';

async function test() {
    console.log('[TEST] AlterBot Local Test Suite\n');
    console.log(`Testing: ${BASE_URL}`);
    console.log(`API Key: ${API_KEY.slice(0, 3)}***\n`);

    // Test 1: Dashboard loads
    console.log('1. Testing dashboard...');
    try {
        const res = await fetch(BASE_URL);
        if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
            console.log('   [OK] Dashboard loads');
            console.log(`   [INFO] Cache-Control: ${res.headers.get('cache-control')}`);
        } else {
            console.log('   [FAIL] Dashboard failed');
        }
    } catch (e) {
        console.log(`   [ERROR] ${e}`);
    }

    // Test 2: Auth required
    console.log('\n2. Testing auth...');
    try {
        const res = await fetch(`${BASE_URL}/status`);
        if (res.status === 401) {
            console.log('   [OK] Auth correctly blocks unauthenticated requests');
        } else {
            console.log('   [WARN] Auth might not be working');
        }
    } catch (e) {
        console.log(`   [ERROR] ${e}`);
    }

    // Test 3: Status endpoint
    console.log('\n3. Testing status endpoint...');
    try {
        const res = await fetch(`${BASE_URL}/status?key=${API_KEY}`);
        if (res.ok) {
            const data = await res.json();
            console.log('   [OK] Status endpoint works');
            console.log(`   [INFO] Connected: ${data.connected}`);
            console.log(`   [INFO] Username: ${data.username || 'N/A'}`);
            console.log(`   [INFO] Config: ${data.config.host}:${data.config.port}`);
        } else {
            console.log(`   [FAIL] Status failed: ${res.status}`);
        }
    } catch (e) {
        console.log(`   [ERROR] ${e}`);
    }

    // Test 4: Apply endpoint (dry run)
    console.log('\n4. Testing apply endpoint...');
    try {
        const res = await fetch(`${BASE_URL}/apply?key=${API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        if (res.ok) {
            const data = await res.json();
            console.log('   [OK] Apply endpoint works');
            console.log(`   [INFO] Response: ${data.message}`);
        } else {
            console.log(`   [FAIL] Apply failed: ${res.status}`);
        }
    } catch (e) {
        console.log(`   [ERROR] ${e}`);
    }

    console.log('\n[DONE] Tests complete\n');
}

test();
