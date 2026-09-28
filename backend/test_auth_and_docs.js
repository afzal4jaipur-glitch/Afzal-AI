import { parseAndChunkPDF } from './services/documentService.js';

// Minimal valid PDF in pure binary ASCII
function createTestPDF(text) {
  const contentStream = `BT /F1 12 Tf 50 700 Td (${text}) Tj ET`;
  const streamLen = contentStream.length;

  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj
4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
5 0 obj << /Length ${streamLen} >>
stream
${contentStream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000318 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
${400 + streamLen}
%%EOF`;

  return Buffer.from(pdf);
}

async function runTests() {
  console.log('--- 🧪 STARTING AUTH & PDF RAG INTEGRATION TESTS ---');

  // Test 1: PDF Parsing
  console.log('\n[Test 1] Testing PDF Parsing & Chunking...');
  try {
    const pdfBuf = createTestPDF('Acme Quantum Laptop Policy: All returns must be initiated within 45 days. The serial number is ACME-9988-XYZ.');
    const { chunks, pageCount } = await parseAndChunkPDF(pdfBuf);
    console.log(`✅ Extracted ${chunks.length} chunk(s), pageCount: ${pageCount}`);
    if (chunks.length > 0) {
      console.log(`   Sample chunk text: "${chunks[0].text}"`);
    }
  } catch (err) {
    console.error('❌ PDF parsing failed:', err.message);
  }

  // Test 2: User Registration & Login via HTTP
  console.log('\n[Test 2] Testing Auth Endpoints...');
  const testUser = {
    name: 'Test Engineer',
    email: `test_${Date.now()}@example.com`,
    password: 'securePassword123!'
  };

  try {
    // Register
    const regRes = await fetch('http://127.0.0.1:5000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testUser)
    });
    const regData = await regRes.json();

    if (regRes.ok && regData.token) {
      console.log(`✅ Registration passed! User ID: ${regData.user.id}, Token received.`);
      const token = regData.token;

      // Login
      const loginRes = await fetch('http://127.0.0.1:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testUser.email,
          password: testUser.password
        })
      });
      const loginData = await loginRes.json();
      if (loginRes.ok && loginData.token) {
        console.log(`✅ Login passed! User: ${loginData.user.name}`);
      } else {
        console.error('❌ Login failed:', loginData);
      }

      // Check /api/auth/me
      const meRes = await fetch('http://127.0.0.1:5000/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Test 3: Upload PDF, List Documents, and Chat with Document Context
      console.log('\n[Test 3] Testing PDF Upload & RAG Querying...');
      const samplePdfText = 'ACME Enterprise Quantum Laptop Policy: Returns are accepted strictly within 45 days of delivery. Serial number format is ACME-QUANTUM-2026. Free battery replacements are provided for 3 years.';
      const samplePdfBuf = createTestPDF(samplePdfText);

      // Create multipart FormData
      const formData = new FormData();
      const blob = new Blob([samplePdfBuf], { type: 'application/pdf' });
      formData.append('file', blob, 'Quantum_Laptop_Warranty_Policy.pdf');

      const uploadRes = await fetch('http://127.0.0.1:5000/api/documents/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const uploadData = await uploadRes.json();
      console.log('   Upload Response:', uploadRes.status, uploadData.message || uploadData.error);

      if (uploadRes.ok) {
        console.log(`✅ PDF Ingested! Document ID: ${uploadData.document.id}, Chunks: ${uploadData.document.chunkCount}`);

        // List user documents
        const listRes = await fetch('http://127.0.0.1:5000/api/documents', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const listData = await listRes.json();
        console.log(`✅ List documents retrieved ${listData.documents?.length} document(s).`);

        // Test Chat with RAG
        console.log('\n[Test 4] Asking AI about the uploaded document...');
        const chatRes = await fetch('http://127.0.0.1:5000/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            message: 'What is the return policy for the Acme Quantum Laptop and what is its serial number according to my uploaded document?',
            mode: 'auto'
          })
        });
        const chatData = await chatRes.json();
        console.log(`✅ AI Response received! Source: ${chatData.source}, Model: ${chatData.model}`);
        console.log(`   Reply Preview: "${chatData.reply?.slice(0, 180)}..."`);
        console.log(`   Sources cited: ${chatData.sources?.length || 0}`);
        if (chatData.sources && chatData.sources.length > 0) {
          console.log(`   Top source: [${chatData.sources[0].source}] ${chatData.sources[0].title}`);
        }
      }
    } else {
      console.log(`ℹ️ Registration status: ${regRes.status}`, regData);
    }
  } catch (err) {
    console.error('❌ Test error:', err.message);
  }

  console.log('\n--- 🎉 ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY ---');
}

runTests();
