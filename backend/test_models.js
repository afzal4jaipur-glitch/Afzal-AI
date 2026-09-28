import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function listModels() {
  try {
    const pager = await ai.models.list();
    for await (const model of pager) {
      if (model.name.includes('embed')) {
        console.log('Available embedding model:', model.name);
      }
    }
  } catch (err) {
    console.error('List models error:', err.message);
  }
}

listModels();
