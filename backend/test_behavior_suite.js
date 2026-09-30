import dotenv from 'dotenv';
dotenv.config();

import { generateAIAnswer } from './services/aiService.js';
import { connectDB } from './services/dbService.js';

async function runBehaviorTests() {
  console.log('===========================================================');
  console.log('🧪 AFZAL AI - GENERAL-PURPOSE ASSISTANT VERIFICATION SUITE');
  console.log('===========================================================\n');

  await connectDB();

  const results = [];

  // -------------------------------------------------------------
  // Test A: "What is photosynthesis?"
  // -------------------------------------------------------------
  console.log('▶ [Test A] "What is photosynthesis?"');
  try {
    const resA = await generateAIAnswer('What is photosynthesis?');
    const isSupportLang = /customer support|refund|return policy|operating hours/i.test(resA.answer);
    const mentionsPhotosynthesis = /photosynthesis|plants|light|chlorophyll|glucose|oxygen|energy/i.test(resA.answer);
    const passed = !isSupportLang && mentionsPhotosynthesis && resA.source === 'gemini-direct';

    console.log(`  Source: ${resA.source}`);
    console.log(`  Model: ${resA.model}`);
    console.log(`  Answer snippet: ${resA.answer.slice(0, 140).replace(/\n/g, ' ')}...`);
    console.log(`  No support language: ${!isSupportLang}`);
    console.log(`  Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
    results.push({ test: 'Test A (Photosynthesis)', passed, sample: resA.answer.slice(0, 100) });
  } catch (err) {
    console.error('  Test A Error:', err.message);
    results.push({ test: 'Test A (Photosynthesis)', passed: false, error: err.message });
  }

  // -------------------------------------------------------------
  // Test B: "What is RAG and how does it work?"
  // -------------------------------------------------------------
  console.log('▶ [Test B] "What is RAG and how does it work?"');
  try {
    const resB = await generateAIAnswer('What is RAG and how does it work?');
    const isSupportLang = /customer support|refund|return policy/i.test(resB.answer);
    const mentionsRAG = /retrieval|augmented|generation|vector|embeddings|knowledge/i.test(resB.answer);
    const passed = !isSupportLang && mentionsRAG && resA_or_direct(resB.source);

    console.log(`  Source: ${resB.source}`);
    console.log(`  Model: ${resB.model}`);
    console.log(`  Answer snippet: ${resB.answer.slice(0, 140).replace(/\n/g, ' ')}...`);
    console.log(`  Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
    results.push({ test: 'Test B (RAG Explanation)', passed, sample: resB.answer.slice(0, 100) });
  } catch (err) {
    console.error('  Test B Error:', err.message);
    results.push({ test: 'Test B (RAG Explanation)', passed: false, error: err.message });
  }

  // -------------------------------------------------------------
  // Test C: "Give me five ideas for a Toastmasters speech."
  // -------------------------------------------------------------
  console.log('▶ [Test C] "Give me five ideas for a Toastmasters speech."');
  try {
    const resC = await generateAIAnswer('Give me five ideas for a Toastmasters speech.');
    const hasIdeas = resC.answer.includes('1') && resC.answer.includes('5');
    const isSupportLang = /customer support|refund|return policy/i.test(resC.answer);
    const passed = !isSupportLang && hasIdeas && resA_or_direct(resC.source);

    console.log(`  Source: ${resC.source}`);
    console.log(`  Model: ${resC.model}`);
    console.log(`  Answer snippet: ${resC.answer.slice(0, 140).replace(/\n/g, ' ')}...`);
    console.log(`  Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
    results.push({ test: 'Test C (Speech Ideas)', passed, sample: resC.answer.slice(0, 100) });
  } catch (err) {
    console.error('  Test C Error:', err.message);
    results.push({ test: 'Test C (Speech Ideas)', passed: false, error: err.message });
  }

  // -------------------------------------------------------------
  // Test D: "Explain the PDF I uploaded."
  // -------------------------------------------------------------
  console.log('▶ [Test D] "Explain the PDF I uploaded." (Testing with uploaded user document: Kant Biography)');
  try {
    const userIdWithDoc = 'user_3JrSTYGeLATKoSoVOstokbNZGp0';
    const resD = await generateAIAnswer('Explain the PDF I uploaded.', { userId: userIdWithDoc });
    const isSupportLang = /customer support|refund|return policy/i.test(resD.answer);
    const mentionsDocOrKant = /kant|biography|document|uploaded/i.test(resD.answer);
    const passed = !isSupportLang && mentionsDocOrKant && (resD.source === 'gemini + user-document' || resD.source === 'gemini-direct');

    console.log(`  Source: ${resD.source}`);
    console.log(`  Model: ${resD.model}`);
    console.log(`  Context matched:`, resD.contextMatched);
    console.log(`  Answer snippet: ${resD.answer.slice(0, 140).replace(/\n/g, ' ')}...`);
    console.log(`  Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
    results.push({ test: 'Test D (Uploaded PDF explanation)', passed, sample: resD.answer.slice(0, 100) });
  } catch (err) {
    console.error('  Test D Error:', err.message);
    results.push({ test: 'Test D (Uploaded PDF explanation)', passed: false, error: err.message });
  }

  // -------------------------------------------------------------
  // Test E: "What is the capital of Japan?"
  // -------------------------------------------------------------
  console.log('▶ [Test E] "What is the capital of Japan?"');
  try {
    const resE = await generateAIAnswer('What is the capital of Japan?');
    const mentionsTokyo = /tokyo/i.test(resE.answer);
    const noPDF = resE.source === 'gemini-direct' && (!resE.sources || resE.sources.length === 0);
    const passed = mentionsTokyo && noPDF;

    console.log(`  Source: ${resE.source}`);
    console.log(`  Model: ${resE.model}`);
    console.log(`  Answer snippet: ${resE.answer.slice(0, 140).replace(/\n/g, ' ')}...`);
    console.log(`  Direct answer without PDF: ${noPDF}`);
    console.log(`  Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
    results.push({ test: 'Test E (Capital of Japan)', passed, sample: resE.answer.slice(0, 100) });
  } catch (err) {
    console.error('  Test E Error:', err.message);
    results.push({ test: 'Test E (Capital of Japan)', passed: false, error: err.message });
  }

  // -------------------------------------------------------------
  // Test F: Multi-turn Follow-up: "Tell me more about the second point."
  // -------------------------------------------------------------
  console.log('▶ [Test F] Follow-up: "Tell me more about the second point."');
  try {
    const historyF = [
      {
        role: 'user',
        content: 'Explain RAG in three clear points.'
      },
      {
        role: 'assistant',
        content: 'Here is how RAG works in three steps:\n1. Ingestion and Indexing: Documents are chunked and converted into vector embeddings.\n2. Vector Retrieval: When a query is made, semantic search retrieves the most relevant chunks.\n3. Grounded Generation: The LLM uses the retrieved context to generate an accurate, hallucination-free answer.'
      }
    ];

    const resF = await generateAIAnswer('Tell me more about the second point.', { history: historyF });
    const mentionsRetrievalOrSearch = /retrieval|vector|semantic search|similarity|cosine|chunks|query/i.test(resF.answer);
    const isSupportLang = /customer support|refund|return policy/i.test(resF.answer);
    const passed = mentionsRetrievalOrSearch && !isSupportLang;

    console.log(`  Source: ${resF.source}`);
    console.log(`  Model: ${resF.model}`);
    console.log(`  Answer snippet: ${resF.answer.slice(0, 150).replace(/\n/g, ' ')}...`);
    console.log(`  Understood second point is retrieval: ${mentionsRetrievalOrSearch}`);
    console.log(`  Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
    results.push({ test: 'Test F (Follow-up memory)', passed, sample: resF.answer.slice(0, 100) });
  } catch (err) {
    console.error('  Test F Error:', err.message);
    results.push({ test: 'Test F (Follow-up memory)', passed: false, error: err.message });
  }

  // -------------------------------------------------------------
  // Test G: "What's happening in the world today?"
  // -------------------------------------------------------------
  console.log('▶ [Test G] "What\'s happening in the world today?"');
  try {
    const resG = await generateAIAnswer("What's happening in the world today?");
    const usedWeb = resG.source === 'tavily-web-research';
    const hasSources = (resG.sources || []).length > 0;
    const passed = usedWeb && hasSources;

    console.log(`  Source: ${resG.source}`);
    console.log(`  Model: ${resG.model}`);
    console.log(`  Sources cited count: ${(resG.sources || []).length}`);
    console.log(`  Answer snippet: ${resG.answer.slice(0, 140).replace(/\n/g, ' ')}...`);
    console.log(`  Used Tavily web research: ${usedWeb}`);
    console.log(`  Result: ${passed ? 'PASSED ✅' : 'FAILED ❌'}\n`);
    results.push({ test: 'Test G (Current world events web research)', passed, sample: resG.answer.slice(0, 100) });
  } catch (err) {
    console.error('  Test G Error:', err.message);
    results.push({ test: 'Test G (Current world events web research)', passed: false, error: err.message });
  }

  console.log('===========================================================');
  console.log('📊 TEST SUMMARY RESULTS:');
  const allPassed = results.every(r => r.passed);
  results.forEach(r => {
    console.log(`  ${r.passed ? '✅' : '❌'} ${r.test}`);
  });
  console.log(`\nOverall: ${allPassed ? 'ALL TESTS PASSED SUCCESSFULLY! 🎉' : 'SOME TESTS FAILED'}`);
  console.log('===========================================================');

  process.exit(allPassed ? 0 : 1);
}

function resA_or_direct(src) {
  return src === 'gemini-direct' || src === 'openai-direct';
}

runBehaviorTests();
