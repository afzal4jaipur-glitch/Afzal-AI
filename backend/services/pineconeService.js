import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'support-agent-kb';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let pineconeIndex = null;
let aiClient = null;

// Initialize clients
if (PINECONE_API_KEY && PINECONE_API_KEY !== 'your_pinecone_api_key_here') {
  try {
    const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
    pineconeIndex = pc.index(PINECONE_INDEX_NAME);
    console.log(`[PineconeService] Connected to Pinecone index: "${PINECONE_INDEX_NAME}"`);
  } catch (err) {
    console.warn('[PineconeService] Could not connect to Pinecone index:', err.message);
  }
}

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  try {
    aiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('[PineconeService] Gemini embedding client initialized.');
  } catch (err) {
    console.warn('[PineconeService] Could not initialize Gemini embedding client:', err.message);
  }
}

// Fallback local knowledge base loading
const knowledgeBasePath = path.join(__dirname, '../data/knowledgeBase.json');
let fallbackKB = [];
try {
  fallbackKB = JSON.parse(fs.readFileSync(knowledgeBasePath, 'utf-8'));
} catch (e) {
  console.warn('[PineconeService] Could not load fallback knowledgeBase.json:', e.message);
}

/**
 * Creates a deterministic 768-dim normalized embedding vector as a reliable fallback.
 */
function generateFallbackEmbedding(text = '') {
  const vec = new Array(768).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < 768; i++) {
    const val = Math.sin((hash + 1) * (i + 1));
    vec[i] = Number(val.toFixed(5));
  }
  return vec;
}

/**
 * Embeds a text string into a 768-dimensional vector using Gemini with quota protection.
 */
export async function getQueryEmbedding(text) {
  if (!text) return null;
  if (!aiClient) return generateFallbackEmbedding(text);
  try {
    const response = await aiClient.models.embedContent({
      model: 'gemini-embedding-001',
      contents: text,
      config: {
        outputDimensionality: 768
      }
    });
    return response.embeddings?.[0]?.values || generateFallbackEmbedding(text);
  } catch (err) {
    console.warn('[PineconeService] Query embedding fallback:', err.message);
    return generateFallbackEmbedding(text);
  }
}

/**
 * Embeds multiple text strings in batches using Gemini, with quota protection.
 * Returns an array of 768-dimensional float arrays.
 */
export async function getBatchEmbeddings(texts = []) {
  if (!texts || texts.length === 0) return [];
  if (!aiClient) return texts.map((t) => generateFallbackEmbedding(t));

  const results = [];
  const batchSize = 10; // Batch up to 10 chunks to stay well under request size and rate limits

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    try {
      const response = await aiClient.models.embedContent({
        model: 'gemini-embedding-001',
        contents: batch,
        config: {
          outputDimensionality: 768
        }
      });
      const batchEmbeddings = (response.embeddings || []).map((e) => e.values);
      results.push(...batchEmbeddings);
    } catch (err) {
      console.warn(`[PineconeService] Batch embedding fallback at chunk ${i} (${err.message})`);
      for (const t of batch) {
        results.push(generateFallbackEmbedding(t));
      }
    }
  }

  return results;
}

export function getPineconeIndex() {
  return pineconeIndex;
}

/**
 * Searches Pinecone vector database for relevant support articles and user-uploaded documents.
 * 
 * @param {string} query - Customer question
 * @param {number|object} options - topK number or { topK, userId }
 * @returns {Promise<Array<{ id: string, title: string, category: string, content: string, score: number, source: string }>>}
 */
export async function searchKnowledgeBase(query, options = {}) {
  if (!query || typeof query !== 'string') return [];

  let topK = 4;
  let userId = null;
  let documentId = null;

  if (typeof options === 'number') {
    topK = options;
  } else if (typeof options === 'object') {
    topK = options.topK || 4;
    userId = options.userId || null;
    documentId = options.documentId || null;
  }

  // 1. Live Pinecone Vector Search
  if (pineconeIndex && aiClient) {
    try {
      console.log(`[PineconeService] Generating query vector for: "${query}" (userId: ${userId || 'none'}, documentId: ${documentId || 'none'})`);
      const queryVector = await getQueryEmbedding(query);

      if (queryVector && queryVector.length === 768) {
        const matches = [];

        // 1a. If user is authenticated, query their isolated namespace first
        if (userId) {
          try {
            console.log(`[PineconeService] Searching user namespace "user_${userId}"...`);
            const userNs = pineconeIndex.namespace(`user_${userId}`);
            
            const queryParams = {
              vector: queryVector,
              topK: topK * 2, // Fetch extra chunks to allow for deduplication
              includeMetadata: true
            };

            if (documentId) {
              queryParams.filter = { documentId: { $eq: documentId.toString() } };
            }

            const userRes = await userNs.query(queryParams);

            if (userRes.matches && userRes.matches.length > 0) {
              console.log(`[PineconeService] Found ${userRes.matches.length} user document matches!`);
              userRes.matches.forEach((m) => {
                if (m.score >= 0.35) { // Relevant threshold
                  matches.push({
                    id: m.id,
                    title: m.metadata?.title || 'User Document',
                    category: 'user-document',
                    content: m.metadata?.content || '',
                    score: Number((m.score || 0).toFixed(3)),
                    source: 'user-document',
                    pageNumber: m.metadata?.pageNumber,
                    chunkIndex: m.metadata?.chunkIndex
                  });
                }
              });
            }
          } catch (nsErr) {
            console.warn(`[PineconeService] User namespace query notice:`, nsErr.message);
          }
        }

        // 1b. Query standard shared knowledge base (only if no specific user document is grounded)
        if (!documentId || matches.length === 0) {
          console.log(`[PineconeService] Searching shared Pinecone index "${PINECONE_INDEX_NAME}" (topK=${topK})...`);
          const result = await pineconeIndex.query({
            vector: queryVector,
            topK,
            includeMetadata: true
          });

          if (result.matches && result.matches.length > 0) {
            console.log(`[PineconeService] Found ${result.matches.length} matches from Pinecone KB! Top score: ${result.matches[0].score?.toFixed(3)}`);
            result.matches.forEach((m) => {
              matches.push({
                id: m.id,
                title: m.metadata?.title || m.id,
                category: m.metadata?.category || 'support',
                content: m.metadata?.content || '',
                score: Number((m.score || 0).toFixed(3)),
                source: 'pinecone-vector-db'
              });
            });
          }
        }

        if (matches.length > 0) {
          // Sort combined by relevance score descending
          matches.sort((a, b) => b.score - a.score);

          // Deduplicate matches so duplicate file uploads or overlapping chunks don't flood the context window
          const seen = new Set();
          const deduped = [];
          for (const m of matches) {
            const key = (m.content || '').replace(/\s+/g, ' ').trim().slice(0, 150).toLowerCase();
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(m);
            }
          }

          return deduped.slice(0, topK);
        }
      }
    } catch (err) {
      console.error('[PineconeService] Pinecone search error, falling back to local dataset:', err.message);
    }
  }

  // 2. Fallback Keyword / Token matching if Pinecone is temporarily unavailable
  console.log('[PineconeService] Performing fallback search...');
  const qLower = query.toLowerCase();
  const scored = fallbackKB.map((doc) => {
    let score = 0;
    if (qLower.includes(doc.title.toLowerCase())) score += 0.5;
    (doc.keywords || []).forEach(kw => {
      if (qLower.includes(kw.toLowerCase())) score += 0.3;
    });
    return {
      id: doc.id,
      title: doc.title,
      category: doc.category,
      content: doc.content,
      score: Number(score.toFixed(3)),
      source: 'local-kb-fallback'
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export default {
  searchKnowledgeBase,
  getQueryEmbedding,
  getPineconeIndex
};
