import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { searchKnowledgeBase } from './pineconeService.js';
import { conductResearch } from './tavilyService.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

let geminiClient = null;

if (GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here') {
  try {
    geminiClient = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    console.log('[AIService] Google Gemini client successfully initialized.');
  } catch (err) {
    console.warn('[AIService] Failed to initialize Google Gemini client:', err.message);
  }
}

// Resilient model hierarchy
const CANDIDATE_MODELS = [
  'gemini-3.6-flash',
  'gemini-flash-latest',
  'gemini-3.8-flash'
];

/**
 * Resilient Gemini caller that handles model fallback and exponential backoff on 503/429
 */
async function callGeminiWithFallback(fullPrompt) {
  if (!geminiClient) return null;

  let lastError = null;

  for (const model of CANDIDATE_MODELS) {
    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await geminiClient.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [{ text: fullPrompt }]
            }
          ]
        });

        const replyText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText && replyText.trim().length > 0) {
          return {
            answer: replyText.trim(),
            model: `Afzal's AI (${model})`
          };
        }
      } catch (err) {
        lastError = err;
        const isTransient = err.status === 503 || err.status === 429 || err.message?.includes('503') || err.message?.includes('429');
        console.warn(`[AIService] Model "${model}" attempt ${attempt} notice: ${err.message?.slice(0, 120)}`);
        if (attempt < maxRetries && isTransient) {
          const delay = attempt * 2000;
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
  }

  console.error('[AIService] All Gemini models failed:', lastError?.message);
  return null;
}

/**
 * Conducts web research using Tavily and synthesizes findings via Gemini.
 * 
 * @param {string} topic - Research query or question
 * @param {object} options - Search options
 * @returns {Promise<{ answer: string, model: string, source: string, sources: Array, topic: string }>}
 */
export async function performResearch(topic, options = {}) {
  const researchData = await conductResearch(topic, options);
  const { sources, contextSnippet, summaryAnswer } = researchData;

  const researchPrompt = `You are an expert AI Research Assistant.
A user asked the following research question:
"${topic}"

Here are real-time web research findings retrieved via Tavily Search:
${contextSnippet}

Instructions:
1. Provide a comprehensive, accurate, and well-structured research briefing.
2. Use markdown formatting with clear headings or bullet points where helpful.
3. Cite information based directly on the provided search findings.
4. Keep the tone objective, informative, and professional.`;

  const geminiResult = await callGeminiWithFallback(researchPrompt);
  if (geminiResult) {
    return {
      answer: geminiResult.answer,
      model: `${geminiResult.model} Research`,
      source: 'tavily-web-research',
      sources,
      topic,
      isResearch: true
    };
  }

  // Fallback to Tavily's built-in AI answer if Gemini is unavailable
  return {
    answer: summaryAnswer || (sources.length > 0 ? sources[0].snippet : "Research completed, but no detailed summary could be generated."),
    model: 'tavily-search-agent',
    source: 'tavily-direct',
    sources,
    topic,
    isResearch: true
  };
}

/**
 * Determines whether a query is explicitly requesting web/real-time research.
 */
function isExplicitResearchQuery(text) {
  const researchTriggers = [
    'research', 'search web', 'latest news', 'current', 'today', '2025', '2026',
    'who is', 'what is happening', 'market trend', 'compare', 'difference between',
    'stock price', 'weather', 'article about'
  ];
  const lower = text.toLowerCase();
  return researchTriggers.some(t => lower.includes(t));
}

/**
 * Generates an AI answer for the user's question.
 * Supports 'auto' (hybrid), 'research' (Tavily), and 'support' (Pinecone) modes.
 * 
 * @param {string} userQuestion - The question asked by the user.
 * @param {object} options - Options including mode, userId, documentId, documentName
 * @returns {Promise<{ answer: string, model: string, source: string, contextMatched?: string[], sources?: Array, pineconeMatches?: Array }>}
 */
export async function generateAIAnswer(userQuestion, options = {}) {
  const mode = options.mode || 'auto';
  const userId = options.userId || null;
  const documentId = options.documentId || null;
  const documentName = options.documentName || null;

  // 1. Explicit Research Mode (only if not specifically grounded on a document)
  if (!documentId && (mode === 'research' || (mode === 'auto' && isExplicitResearchQuery(userQuestion)))) {
    try {
      console.log(`[AIService] Routing to Tavily Web Research for: "${userQuestion}"`);
      return await performResearch(userQuestion);
    } catch (err) {
      console.warn('[AIService] Tavily research error, falling back to knowledge base:', err.message);
    }
  }

  // 2. Query Pinecone Vector Database (User documents namespace + Shared Support Base)
  const matches = await searchKnowledgeBase(userQuestion, { topK: 4, userId, documentId, documentName });
  const topScore = matches[0]?.score || 0;
  const hasUserDocs = matches.some(m => m.source === 'user-document');

  const contextSnippet = matches
    .map(m => `[Source: ${m.source === 'user-document' ? 'User Uploaded PDF: ' + m.title : 'Knowledge Base: ' + m.title}] (Score: ${m.score}):\n${m.content}`)
    .join('\n\n');
  const matchedTitles = [...new Set(matches.map(m => m.title))];

  // If in 'auto' mode, no user documents matched, and Pinecone KB has very low relevance, fallback to web research
  if (mode === 'auto' && !hasUserDocs && !documentId && topScore < 0.35 && matches.length > 0) {
    try {
      console.log(`[AIService] Low Pinecone score (${topScore}) and no user docs matched. Autonomously triggering Tavily web search...`);
      return await performResearch(userQuestion);
    } catch (err) {
      console.warn('[AIService] Autonomous Tavily fallback failed, continuing with Pinecone:', err.message);
    }
  }

  // Format sources from matches
  const sources = matches.map(m => ({
    id: m.id,
    title: m.title,
    snippet: m.content ? m.content.slice(0, 200) + '...' : '',
    score: m.score,
    source: m.source || 'pinecone-vector-db',
    pageNumber: m.pageNumber,
    chunkIndex: m.chunkIndex
  }));

  // 3. Query Google Gemini LLM with Context
  const systemInstruction = `You are a helpful, professional, and friendly AI Customer Support and Document Analysis Assistant.
You have access to the user's uploaded PDF documents as well as our company knowledge base.
Follow the user's specific constraints (such as word count or formatting limits) closely.
When the customer asks about their uploaded files or information contained in them, answer accurately, politely, and cite the document title.
Do not make up facts. If the information isn't in their documents or the knowledge base, be honest and offer further assistance.

Context Information:
${contextSnippet}`;

  const promptText = `${systemInstruction}\n\nCustomer Question: ${userQuestion}`;
  const geminiResult = await callGeminiWithFallback(promptText);

  if (geminiResult) {
    return {
      answer: geminiResult.answer,
      model: geminiResult.model,
      source: hasUserDocs ? 'gemini + user-document' : 'gemini + pinecone',
      contextMatched: matchedTitles,
      pineconeMatches: matches,
      sources
    };
  }

  // 4. If OpenAI API Key is available
  if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            {
              role: 'system',
              content: `You are an AI Customer Support Agent. Answer politely based on this context:\n${contextSnippet}`
            },
            { role: 'user', content: userQuestion }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = data.choices?.[0]?.message?.content;
        if (replyText) {
          return {
            answer: replyText.trim(),
            model: 'gpt-4o-mini',
            source: 'openai + pinecone',
            contextMatched: matchedTitles,
            pineconeMatches: matches,
            sources: []
          };
        }
      }
    } catch (err) {
      console.error('[AIService] Error calling OpenAI API:', err.message);
    }
  }

  // 5. Fallback contextual synthesis - provide structured quote instead of dumping raw chunk text
  const topMatch = matches[0];
  const docTitle = topMatch?.title || 'your document';
  const fallbackMessage = topMatch?.content
    ? `Based on **${docTitle}**, here is the most relevant section found:\n\n> "${topMatch.content.slice(0, 450).trim()}..."\n\n*(Note: Real-time AI synthesis was momentarily delayed. Please try your question again in a few moments.)*`
    : "Thank you for contacting customer support. We are here to help!";

  return {
    answer: fallbackMessage,
    model: 'pinecone-context-agent',
    source: hasUserDocs ? 'pinecone-user-document' : 'pinecone-direct',
    contextMatched: matchedTitles,
    pineconeMatches: matches,
    sources
  };
}

export default {
  generateAIAnswer,
  performResearch
};
