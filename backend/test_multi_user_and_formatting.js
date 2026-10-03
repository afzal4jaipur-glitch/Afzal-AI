import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });
import mongoose from 'mongoose';
import { connectDB, saveMessage, getSessionHistory, getUserConversations, deleteUserConversation } from './services/dbService.js';
import { embedAndUpsertDocument, getUserDocuments, getDocumentById, deleteUserDocument } from './services/documentService.js';
import { cleanConversationalFormatting } from './services/aiService.js';

async function runTestSuite() {
  console.log('================================================================');
  console.log('AFZAL AI - MULTI-USER WORKSPACE & AI FORMATTING TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let totalTests = 0;
  await connectDB();

  function assert(condition, testName) {
    totalTests++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      passedTests++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  // -------------------------------------------------------------
  // PART 1: AI RESPONSE FORMATTING TESTS
  // -------------------------------------------------------------
  console.log('--- PART 1: AI Response Formatting Verification ---');

  const testCases = [
    {
      name: 'No decorative bolding on simple answers',
      input: 'The capital of Japan is **Tokyo**.',
      query: 'What is the capital of Japan?',
      expected: 'The capital of Japan is Tokyo.'
    },
    {
      name: 'No decorative asterisks on starting word',
      input: '**Tokyo** is the capital of Japan.',
      query: 'What is the capital of Japan?',
      expected: 'Tokyo is the capital of Japan.'
    },
    {
      name: 'No decorative triple asterisks',
      input: 'The answer is ***Tokyo***.',
      query: 'What is the capital of Japan?',
      expected: 'The answer is Tokyo.'
    },
    {
      name: 'No unnecessary headings for simple answers',
      input: '### Capital of Japan\n\nThe capital of Japan is **Tokyo**.',
      query: 'What is the capital of Japan?',
      expected: 'The capital of Japan is Tokyo.'
    },
    {
      name: 'No single-bullet artifact for single item',
      input: '* The capital of Japan is Tokyo.',
      query: 'What is the capital of Japan?',
      expected: 'The capital of Japan is Tokyo.'
    },
    {
      name: 'Preserve genuine multi-item lists',
      input: 'Here are 3 tips for writing:\n* Plan ahead and outline\n* Write a draft without editing\n* Review and revise',
      query: 'Give me 3 tips for writing',
      check: (res) => res.includes('* Plan ahead and outline') && res.includes('* Write a draft without editing') && res.includes('* Review and revise')
    },
    {
      name: 'Preserve code blocks when code is generated',
      input: 'Here is the function:\n```javascript\nfunction greet() {\n  return "hello";\n}\n```',
      query: 'Write a javascript function to greet',
      check: (res) => res.includes('```javascript') && res.includes('return "hello";')
    },
    {
      name: 'Preserve explicit markdown when requested by user',
      input: '### Summary Table\n| Item | Cost |\n|---|---|\n| Apple | $1 |',
      query: 'Give me a table formatted with markdown',
      check: (res) => res.includes('### Summary Table') && res.includes('| Apple | $1 |')
    }
  ];

  for (const tc of testCases) {
    const cleaned = cleanConversationalFormatting(tc.input, tc.query);
    if (tc.expected) {
      assert(cleaned.trim() === tc.expected.trim(), `${tc.name} -> "${cleaned}"`);
    } else if (tc.check) {
      assert(tc.check(cleaned), `${tc.name}`);
    }
  }

  // -------------------------------------------------------------
  // PART 2: PERSONAL USER WORKSPACE ISOLATION TESTS
  // -------------------------------------------------------------
  console.log('\n--- PART 2: Personal User Workspace & Document Isolation ---');

  const userA = 'user_clerk_test_alice_' + Date.now();
  const userB = 'user_clerk_test_bob_' + Date.now();
  const sessionA = 'session_alice_' + Date.now();
  const sessionB = 'session_bob_' + Date.now();

  // Test 2.1: Conversation isolation
  await saveMessage({
    userId: userA,
    sessionId: sessionA,
    role: 'user',
    content: "Alice's private secret note"
  });
  await saveMessage({
    userId: userA,
    sessionId: sessionA,
    role: 'assistant',
    content: "I have recorded your private note, Alice."
  });

  const convsA = await getUserConversations(userA);
  const convsB = await getUserConversations(userB);

  assert(convsA.length === 1 && convsA[0].sessionId === sessionA, "User A sees User A's conversation");
  assert(convsB.length === 0, "User B sees 0 conversations (User B cannot see User A's conversation)");

  // Test 2.2: Message history isolation
  const historyForUserA = await getSessionHistory({ sessionId: sessionA, userId: userA });
  const historyAttemptByB = await getSessionHistory({ sessionId: sessionA, userId: userB });

  assert(historyForUserA.length === 2, "User A can retrieve their own conversation history");
  assert(historyAttemptByB.length === 0, "User B cannot retrieve User A's history even when targeting User A's sessionId");

  // Test 2.3: Document library isolation
  const dummyPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 <<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 4 0 R\n>>\nendobj\n4 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 24 Tf\n100 700 Td\n(Confidential Alice Document) Tj\nET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n \n0000000294 00000 n \ntrailer\n<<\n/Size 5\n/Root 1 0 R\n>>\nstartxref\n388\n%%EOF');

  const docA = await embedAndUpsertDocument(userA, 'Alice_Contract.pdf', dummyPdfBuffer, dummyPdfBuffer.length);
  assert(docA && docA.originalName === 'Alice_Contract.pdf', "User A successfully uploaded a PDF");

  const docsUserA = await getUserDocuments(userA);
  const docsUserB = await getUserDocuments(userB);

  assert(docsUserA.length === 1 && docsUserA[0].originalName === 'Alice_Contract.pdf', "User A sees their uploaded document in their library");
  assert(docsUserB.length === 0, "User B's document library is empty (User B cannot see User A's document)");

  // Test 2.4: Direct document access security (User B attempting to read User A's doc)
  const docFetchByA = await getDocumentById(userA, docA.id);
  const docFetchByB = await getDocumentById(userB, docA.id);

  assert(docFetchByA !== null && docFetchByA.originalName === 'Alice_Contract.pdf', "User A can access their own document details");
  assert(docFetchByB === null, "User B is denied access when attempting to retrieve User A's document by ID");

  // Test 2.5: Document deletion security (User B attempting to delete User A's doc)
  let userBDeleteFailed = false;
  try {
    await deleteUserDocument(userB, docA.id);
  } catch (err) {
    userBDeleteFailed = true;
  }
  assert(userBDeleteFailed, "User B is rejected with error when attempting to delete User A's document");

  const docAfterUnauthorizedAttempt = await getDocumentById(userA, docA.id);
  assert(docAfterUnauthorizedAttempt !== null, "User A's document remains intact after User B's unauthorized deletion attempt");

  // Clean up
  await deleteUserDocument(userA, docA.id);
  await deleteUserConversation(userA, sessionA);

  console.log('\n================================================================');
  console.log(`TEST RESULTS: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('================================================================\n');

  process.exit(passedTests === totalTests ? 0 : 1);
}

runTestSuite().catch((err) => {
  console.error('Test suite failed with unhandled error:', err);
  process.exit(1);
});
