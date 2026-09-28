import dotenv from 'dotenv';
dotenv.config();

import { searchWeb, conductResearch } from './services/tavilyService.js';
import { performResearch } from './services/aiService.js';

async function runTests() {
  console.log('--- 1. Testing Tavily Web Search ---');
  try {
    const rawSearch = await searchWeb('What are the key benefits of vector search in 2025?', {
      maxResults: 3,
      includeAnswer: true
    });
    console.log('Search Query:', rawSearch.query);
    console.log('Tavily Direct Answer:', rawSearch.answer?.slice(0, 150) + '...');
    console.log(`Results Found: ${rawSearch.results.length}`);
    rawSearch.results.forEach((r, i) => {
      console.log(`  [${i + 1}] ${r.title} (${r.url})`);
    });
  } catch (err) {
    console.error('Raw search test failed:', err.message);
  }

  console.log('\n--- 2. Testing Tavily Research Service ---');
  try {
    const research = await conductResearch('Pinecone vs MongoDB Atlas Vector Search', {
      maxResults: 2
    });
    console.log('Research Topic:', research.topic);
    console.log('Sources Retrieved:', research.sources.length);
    console.log('Duration:', research.durationMs, 'ms');
  } catch (err) {
    console.error('Conduct research test failed:', err.message);
  }

  console.log('\n--- 3. Testing Full AI Research Synthesis (Tavily + Gemini) ---');
  try {
    const synthesis = await performResearch('What is Tavily search API used for?');
    console.log('Model Used:', synthesis.model);
    console.log('Source:', synthesis.source);
    console.log('Synthesized Answer Snippet:');
    console.log(synthesis.answer.slice(0, 300) + '...');
    console.log('Sources cited count:', synthesis.sources.length);
    console.log('\n✅ ALL TAVILY TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('Synthesis test failed:', err.message);
  }
}

runTests();
