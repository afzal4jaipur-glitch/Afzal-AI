import { searchKnowledgeBase } from './services/pineconeService.js';
import dotenv from 'dotenv';
dotenv.config();

async function testSearch() {
  console.log('Testing live Pinecone search...');
  const results = await searchKnowledgeBase('How do I return an item and get my money back?', 2);
  console.log('Search Results from Pinecone:');
  console.log(JSON.stringify(results, null, 2));
}

testSearch();
