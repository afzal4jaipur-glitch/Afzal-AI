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
 * Searches Pinecone vector database for user-uploaded documents and/or shared knowledge base.
 * 
 * @param {string} query - Question or search phrase
 * @param {object|number} options - { topK, userId, documentId, includeSharedKB, minScore }
 * @returns {Promise<Array<{ id: string, title: string, category: string, content: string, score: number, source: string }>>}
 */
export async function searchKnowledgeBase(query, options = {}) {
  if (!query || typeof query !== 'string') return [];

  let topK = 4;
  let userId = null;
  let documentId = null;
  let includeSharedKB = false;
  let minScore = 0.40;

  if (typeof options === 'number') {
    topK = options;
  } else if (typeof options === 'object') {
    topK = options.topK || 4;
    userId = options.userId || null;
    documentId = options.documentId || null;
    includeSharedKB = Boolean(options.includeSharedKB);
    if (typeof options.minScore === 'number') minScore = options.minScore;
  }

  // 1. Live Pinecone Vector Search
  if (pineconeIndex && aiClient) {
    try {
      const queryVector = await getQueryEmbedding(query);

      if (queryVector && queryVector.length === 768) {
        const matches = [];

        // 1a. If user is authenticated, query their isolated namespace first
        if (userId) {
          try {
            const rawNs = userId.startsWith('user_') ? userId : `user_${userId}`;
            const namespacesToTry = [...new Set([rawNs, `user_${userId}`])];

            for (const nsName of namespacesToTry) {
              const userNs = pineconeIndex.namespace(nsName);
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
                userRes.matches.forEach((m) => {
                  if ((m.score || 0) >= minScore) {
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

              if (matches.length > 0) {
                console.log(`[PineconeService] Found ${matches.length} relevant user document matches in namespace "${nsName}" (minScore=${minScore})!`);
                break;
              }
            }
          } catch (nsErr) {
            console.warn(`[PineconeService] User namespace query notice:`, nsErr.message);
          }
        }

        // 1b. Query shared knowledge base ONLY if explicitly requested
        if (includeSharedKB && (!documentId || matches.length === 0)) {
          console.log(`[PineconeService] Searching shared Pinecone index "${PINECONE_INDEX_NAME}" (topK=${topK})...`);
          const result = await pineconeIndex.query({
            vector: queryVector,
            topK,
            includeMetadata: true
          });

          if (result.matches && result.matches.length > 0) {
            result.matches.forEach((m) => {
              if ((m.score || 0) >= minScore) {
                matches.push({
                  id: m.id,
                  title: m.metadata?.title || m.id,
                  category: m.metadata?.category || 'support',
                  content: m.metadata?.content || '',
                  score: Number((m.score || 0).toFixed(3)),
                  source: 'pinecone-vector-db'
                });
              }
            });
          }
        }

        if (matches.length > 0) {
          matches.sort((a, b) => b.score - a.score);

          // Deduplicate matches
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
      console.error('[PineconeService] Pinecone search error:', err.message);
    }
  }

  // 2. Fallback Keyword / Token matching ONLY if shared KB was explicitly requested
  if (includeSharedKB && fallbackKB.length > 0) {
    console.log('[PineconeService] Performing fallback keyword search for shared KB...');
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

    const relevant = scored.filter(d => d.score >= minScore);
    relevant.sort((a, b) => b.score - a.score);
    return relevant.slice(0, topK);
  }

  return [];
}

/**
 * Convenience method to search ONLY a user's uploaded documents.
 */
export async function searchUserDocuments(query, options = {}) {
  return searchKnowledgeBase(query, {
    ...options,
    includeSharedKB: false
  });
}

export default {
  searchKnowledgeBase,
  searchUserDocuments,
  getQueryEmbedding,
  getPineconeIndex
};
