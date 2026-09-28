import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function testEmbedding() {
  try {
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: 'What is your return policy?',
      config: {
        outputDimensionality: 768
      }
    });
    const vals = response.embeddings?.[0]?.values;
    console.log('Dimension with outputDimensionality 768:', vals?.length);
  } catch (err) {
    console.error('Embedding error:', err.message);
  }
}

testEmbedding();
