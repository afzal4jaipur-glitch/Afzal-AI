import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: 'Say Hello in one word'
    });
    console.log('Gemini gemini-3.6-flash Success:', response.text);
  } catch (err) {
    console.error('gemini-3.6-flash Error:', err.message);
  }
}

test();
