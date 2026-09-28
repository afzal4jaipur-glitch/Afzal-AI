import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
dotenv.config();

console.log('Testing Pinecone API key...');
console.log('Pinecone key prefix:', (process.env.PINECONE_API_KEY || '').substring(0, 10));

const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

async function test() {
  try {
    const indexes = await pc.listIndexes();
    console.log('Pinecone connection success! Existing indexes:', indexes);
  } catch (err) {
    console.error('Pinecone Error:', err);
  }
}

test();
