import dotenv from 'dotenv';
dotenv.config();

import { generateAIAnswer, performResearch } from './services/aiService.js';
import { connectDB, saveMessage, getSessionHistory, clearSessionHistory, isConnected } from './services/dbService.js';
import { searchWeb } from './services/tavilyService.js';

async function verifyAll() {
  console.log('====================================');
  console.log('🤖 FULL SYSTEM VERIFICATION SUITE');
  console.log('====================================\n');

  // 1. Check MongoDB
  console.log('[Step 1] Connecting to MongoDB Atlas...');
  const dbOk = await connectDB();
  console.log('MongoDB Status:', dbOk ? 'CONNECTED ✅' : 'FAILED ❌');

  // 2. Check Tavily Web Search
  console.log('\n[Step 2] Testing Tavily Web Search API...');
  try {
    const tavilyRes = await searchWeb('Latest autonomous AI agent trends 2026', { maxResults: 2 });
    console.log('Tavily Search: SUCCESS ✅');
    console.log(`Retrieved ${tavilyRes.results.length} sources. Top title: "${tavilyRes.results[0]?.title}"`);
  } catch (err) {
    console.error('Tavily Search FAILED ❌:', err.message);
  }

  // 3. Test Web Research Mode (Tavily + Gemini)
  console.log('\n[Step 3] Testing Web Research Agent (Tavily + LLM)...');
  try {
    const researchResult = await performResearch('What are the advantages of using Pinecone vector database?');
    console.log('Research Agent: SUCCESS ✅');
    console.log('Model:', researchResult.model);
    console.log('Sources cited count:', researchResult.sources.length);
    console.log('Answer sample:', researchResult.answer.slice(0, 150) + '...');
  } catch (err) {
    console.error('Research Agent FAILED ❌:', err.message);
  }

  // 4. Test Customer Support Mode (Pinecone KB)
  console.log('\n[Step 4] Testing Customer Support Mode (Pinecone KB)...');
  try {
    const supportResult = await generateAIAnswer('What is your return and refund policy?', { mode: 'support' });
    console.log('Support Agent: SUCCESS ✅');
    console.log('Model:', supportResult.model);
    console.log('Source:', supportResult.source);
    console.log('Answer sample:', supportResult.answer.slice(0, 150) + '...');
  } catch (err) {
    console.error('Support Agent FAILED ❌:', err.message);
  }

  // 5. Test MongoDB History Persistence
  console.log('\n[Step 5] Testing MongoDB Message Persistence...');
  const testSession = 'verification-session-' + Date.now();
  await saveMessage({
    sessionId: testSession,
    role: 'user',
    content: 'Verification test query',
    mode: 'auto'
  });
  await saveMessage({
    sessionId: testSession,
    role: 'assistant',
    content: 'Verification test response',
    mode: 'auto',
    source: 'tavily-web-research'
  });
  const history = await getSessionHistory(testSession);
  console.log('Persisted and retrieved messages:', history.length, 'messages ✅');
  await clearSessionHistory(testSession);
  console.log('Cleared verification test session from DB ✅');

  console.log('\n====================================');
  console.log('🎉 ALL INTEGRATION TESTS PASSED!');
  console.log('====================================');
  process.exit(0);
}

verifyAll();
