import http from 'http';

async function testEndpoint(path, method = 'GET', headers = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 5000,
        path,
        method,
        headers
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.end();
  });
}

async function runTests() {
  console.log('Testing Clerk Authentication Endpoints on Backend...\n');

  try {
    // 1. Health check
    const health = await testEndpoint('/api/health');
    console.log('[Test 1] GET /api/health');
    console.log('Status:', health.status);
    console.log('Auth Feature:', health.body?.features?.auth);
    console.log(health.body?.features?.auth === 'Clerk Authentication' ? 'PASS' : 'FAIL');
    console.log('');

    // 2. Unauthenticated /api/auth/me
    const me = await testEndpoint('/api/auth/me');
    console.log('[Test 2] GET /api/auth/me (Unauthenticated)');
    console.log('Status:', me.status);
    console.log('Error message:', me.body?.error);
    console.log(me.status === 401 ? 'PASS (401 Protected)' : 'FAIL');
    console.log('');

    // 3. Unauthenticated /api/documents
    const docs = await testEndpoint('/api/documents');
    console.log('[Test 3] GET /api/documents (Unauthenticated)');
    console.log('Status:', docs.status);
    console.log('Error message:', docs.body?.error);
    console.log(docs.status === 401 ? 'PASS (401 Protected)' : 'FAIL');
    console.log('');

    console.log('Clerk Backend Authentication Verification Completed Successfully!');
  } catch (err) {
    console.error('Test failed to connect:', err.message);
  }
}

runTests();
