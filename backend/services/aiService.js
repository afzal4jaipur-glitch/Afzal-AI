import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import { searchKnowledgeBase, searchUserDocuments } from './pineconeService.js';
import { conductResearch } from './tavilyService.js';
import { getUserDocuments, getDocumentById } from './documentService.js';

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

// Resilient model hierarchies with prioritized active models
export const CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-flash-latest',
  'gemini-flash-lite-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.6-flash'
];

export const PRO_CANDIDATE_MODELS = [
  'gemini-3.8-flash',
  'gemini-2.5-pro',
  'gemini-pro-latest',
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-3.6-flash'
];

export const DEFAULT_SYSTEM_INSTRUCTION = `You are Afzal AI, an intelligent, versatile, thoughtful, and capable personal AI workspace assistant (similar in interaction style, precision, and natural conversational depth to ChatGPT).

Core Conversational & Formatting Instructions:
1. Natural Conversation First:
   - Respond in a clean, natural, human conversational style.
   - Do NOT unnecessarily use Markdown symbols (#, **, *, or decorative symbols).
   - Do NOT unnecessarily bold or italicize ordinary words, entity names, or answers (e.g. write "The capital of Japan is Tokyo.", NEVER "The capital of Japan is **Tokyo**" or "***Tokyo***").
   - Do NOT use headings for very simple or direct answers.
   - Do NOT use bullet points or numbered lists for single items or simple questions.
   - Keep normal answers conversational, clear, and easy to read.
   - Use clean paragraphs for normal explanations.
2. When Structure is Genuinely Useful:
   - Use bullets or numbering ONLY when the response genuinely contains multiple items, steps, or comparisons that improve readability.
   - Even in lists, do not unnecessarily bold ordinary words in each bullet.
3. User-Requested Formatting:
   - Preserve full Markdown, headings, tables, code blocks, or formatting ONLY when the user explicitly requests them (e.g. "format as markdown", "give me a table", "write code").
4. Multi-turn Memory:
   - You are conversing in an ongoing thread. Pay close attention to previous conversation turns to understand follow-up questions, references, and pronouns.
5. Grounding Integrity:
   - When user document excerpts (PDFs) are provided, answer accurately using the excerpts and cite the document title. If not found in the document, state that clearly and offer general knowledge while distinguishing the two.
   - When web research findings are provided, ground your answer in verified findings and cite sources naturally.
6. Tone:
   - Thoughtful, knowledgeable, objective, polite, and helpful. Never use call-center clichés like "Thank you for contacting customer support" or "How may I assist you today?". Never refer to yourself as customer support.`;

/**
 * Strips unnecessary decorative Markdown formatting symbols (#, **, *, ***)
 * from conversational responses when the user did not explicitly request formatted Markdown.
 * Preserves code blocks, tables, and genuine multi-item lists.
 * 
 * @param {string} text - Raw AI response
 * @param {string} userQuestion - User query
 * @returns {string} Clean conversational response
 */
export function cleanConversationalFormatting(text, userQuestion = '') {
  if (!text || typeof text !== 'string') return text;

  // Preserve markdown if user explicitly asked for formatting, code, tables, etc.
  const explicitFormatting = /\b(markdown|format|formatted|headings?|code|table|json|html|syntax|latex)\b/i.test(userQuestion);
  if (explicitFormatting) {
    return text.trim();
  }

  // Preserve fenced code blocks or markdown tables
  if (text.includes('```') || text.includes('|---')) {
    return text.trim();
  }

  let cleaned = text;

  // 1. Strip triple asterisks (***word*** -> word)
  cleaned = cleaned.replace(/\*{3,}([^*\n]+?)\*{3,}/g, '$1');

  // 2. Strip unnecessary bolding on ordinary words/terms (do not cross newlines)
  // e.g. "The capital of Japan is **Tokyo**." -> "The capital of Japan is Tokyo."
  cleaned = cleaned.replace(/\*\*([^*\n]+?)\*\*/g, '$1');

  // 3. Strip unnecessary italics on single terms/phrases on the same line
  cleaned = cleaned.replace(/(^|[\s(\[])\*([a-zA-Z0-9][a-zA-Z0-9 \t.,'’–\-_/]{0,60})\*([)\],.!?;\s]|$)/gm, '$1$2$3');

  // 4. Clean single-bullet or single-number artifacts:
  const lines = cleaned.split('\n');
  const bulletIndices = [];
  const numberedIndices = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (/^[-*•]\s+/.test(trimmed)) bulletIndices.push(idx);
    if (/^\d+[\.\)]\s+/.test(trimmed)) numberedIndices.push(idx);
  });

  // If there is only ONE bullet item in the entire response, convert it to normal prose
  if (bulletIndices.length === 1) {
    const idx = bulletIndices[0];
    lines[idx] = lines[idx].replace(/^(\s*)[-*•]\s+/, '$1');
  }

  // If there is only ONE numbered item in the entire response, convert it to normal prose
  if (numberedIndices.length === 1) {
    const idx = numberedIndices[0];
    lines[idx] = lines[idx].replace(/^(\s*)\d+[\.\)]\s+/, '$1');
  }

  cleaned = lines.join('\n');

  // 5. Remove unnecessary headings for very simple answers (<= 4 non-empty lines)
  const nonEmptyLines = cleaned.split('\n').filter(l => l.trim().length > 0);
  if (nonEmptyLines.length <= 4 && bulletIndices.length === 0 && numberedIndices.length === 0) {
    const splitLines = cleaned.split('\n');
    let firstNonEmptyIdx = -1;
    for (let i = 0; i < splitLines.length; i++) {
      if (splitLines[i].trim().length > 0) {
        firstNonEmptyIdx = i;
        break;
      }
    }

    if (firstNonEmptyIdx >= 0) {
      const firstLine = splitLines[firstNonEmptyIdx].trim();
      const isHeading = /^#{1,6}\s+/.test(firstLine);
      const isAnswerLabel = /^(answer|response|summary):\s*$/i.test(firstLine);

      if (isHeading || isAnswerLabel) {
        if (nonEmptyLines.length > 1) {
          splitLines.splice(firstNonEmptyIdx, 1);
          cleaned = splitLines.join('\n');
        } else {
          cleaned = cleaned.replace(/^#{1,6}\s+/, '');
        }
      }
    }
  }

  // 6. Clean up stray leading heading hashes if any still remain on short answers
  if (nonEmptyLines.length <= 3) {
    cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  }

  // 7. Clean up redundant trailing spaces and excessive blank lines
  cleaned = cleaned
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return cleaned;
}

/**
 * Normalizes conversation history into Gemini's strictly alternating contents format.
 * 
 * @param {string} userQuestion - Latest user prompt
 * @param {Array<{ role: string, content?: string, text?: string }>} history - Prior messages
 * @param {string} contextSnippet - Optional grounding context
 * @returns {Array<{ role: 'user' | 'model', parts: Array<{ text: string }> }>}
 */
export function buildGeminiContents(userQuestion, history = [], contextSnippet = '') {
  const contents = [];

  // 1. Process prior turns
  if (Array.isArray(history) && history.length > 0) {
    for (const msg of history) {
      const role = (msg.role === 'assistant' || msg.role === 'model') ? 'model' : 'user';
      const text = (msg.content || msg.text || '').trim();

      // Skip blank or initial greeting messages
      if (!text || text.startsWith('Hello! How can I help you today?') || text.startsWith("Hello! I'm Afzal AI")) {
        continue;
      }

      // Gemini requires alternating roles (user, model, user, model)
      const lastMsg = contents[contents.length - 1];
      if (lastMsg && lastMsg.role === role) {
        lastMsg.parts[0].text += `\n\n${text}`;
      } else {
        contents.push({
          role,
          parts: [{ text }]
        });
      }
    }
  }

  // 2. Format current turn with any grounding context
  let currentTurnText = userQuestion;
  if (contextSnippet && contextSnippet.trim().length > 0) {
    currentTurnText = `${contextSnippet.trim()}\n\nUser Question:\n${userQuestion}`;
  }

  // 3. Ensure valid role alternation with current turn
  const lastMsg = contents[contents.length - 1];
  if (lastMsg && lastMsg.role === 'user') {
    // History ended on user turn, append to avoid invalid back-to-back user turns
    lastMsg.parts[0].text += `\n\n${currentTurnText}`;
  } else {
    contents.push({
      role: 'user',
      parts: [{ text: currentTurnText }]
    });
  }

  return contents;
}

/**
 * Resilient Gemini caller that handles model fallback and transient error recovery.
 * 
 * @param {Array|string} contents - Gemini contents array or prompt string
 * @param {object} options - Call options (systemInstruction, modelTier, temperature)
 */
export async function callGeminiWithFallback(contents, options = {}) {
  if (!geminiClient) return null;

  const systemInstruction = options.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION;
  const modelTier = options.modelTier || 'flash';
  const candidates = modelTier === 'pro' ? PRO_CANDIDATE_MODELS : CANDIDATE_MODELS;

  const formattedContents = typeof contents === 'string'
    ? [{ role: 'user', parts: [{ text: contents }] }]
    : contents;

  let lastError = null;

  for (let pass = 1; pass <= 2; pass++) {
    for (const model of candidates) {
      try {
        const response = await geminiClient.models.generateContent({
          model,
          contents: formattedContents,
          config: {
            systemInstruction,
            temperature: options.temperature ?? 0.7
          }
        });

        const replyText = response.text || response.candidates?.[0]?.content?.parts?.[0]?.text;
        if (replyText && replyText.trim().length > 0) {
          return {
            answer: replyText.trim(),
            model: `Afzal AI (${model})`
          };
        }
      } catch (err) {
        lastError = err;
        const isTransient = err.status === 503 || err.status === 429 || err.status === 404 ||
          err.message?.includes('503') || err.message?.includes('429') || err.message?.includes('404') ||
          err.message?.includes('high demand');
        console.warn(`[AIService] Model "${model}" notice: ${err.message?.slice(0, 100)}`);
        if (isTransient) {
          // Fast failover to next candidate model without sleeping
          continue;
        }
      }
    }
    if (pass < 2) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  console.error('[AIService] All Gemini candidate models failed:', lastError?.message);
  return null;
}

/**
 * Determines whether a query is explicitly or contextually requesting web/real-time research.
 */
export function isWebResearchRequest(userQuestion, options = {}) {
  if (options.mode === 'research') return true;

  const lower = userQuestion.toLowerCase();
  
  // Explicit web search commands
  const explicitSearchCommands = [
    'search the web', 'search online', 'web search', 'look up online',
    'browse the web', 'google this', 'research on the web', 'search internet'
  ];
  if (explicitSearchCommands.some(cmd => lower.includes(cmd))) return true;

  // Real-time live events or current news
  const liveTriggers = [
    "what's happening in the world today",
    "what is happening in the world today",
    "what is happening in the world",
    "latest news today",
    "breaking news today",
    "breaking news",
    "news today",
    "current events today",
    "today's headlines",
    "weather right now",
    "stock price today",
    "live score"
  ];
  return liveTriggers.some(t => lower.includes(t));
}

/**
 * Determines whether a query explicitly or contextually refers to uploaded documents/PDFs.
 */
export function isDocumentRequest(userQuestion, options = {}) {
  if (options.documentId || options.documentName) return true;
  if (options.mode === 'support') return true;

  const lower = userQuestion.toLowerCase();
  const docKeywords = [
    'pdf', 'document', 'uploaded file', 'uploaded doc', 'in my file',
    'attached document', 'in the doc', 'summarize my doc', 'summarize the doc',
    'what does the document say', 'according to the pdf', 'in this paper',
    'explain the pdf', 'explain the document', 'the file i uploaded',
    'my uploaded pdf', 'my pdf', 'analyze the document', 'from the pdf',
    'according to the uploaded'
  ];
  return docKeywords.some(kw => lower.includes(kw));
}

/**
 * Determines whether a query specifically asks about platform policies or customer support FAQs.
 */
export function isCompanySupportRequest(userQuestion) {
  const lower = userQuestion.toLowerCase();
  const supportTriggers = [
    'return policy', 'refund policy', 'shipping timeline', 'delivery timeline',
    'customer support hours', 'support hours', 'operating hours',
    'payment method', 'order tracking', 'track my order', 'product warranty',
    'how to return', 'rma'
  ];
  return supportTriggers.some(t => lower.includes(t));
}

/**
 * Conducts web research using Tavily and synthesizes findings via Gemini.
 * 
 * @param {string} topic - Research query or question
 * @param {object} options - Search options
 * @returns {Promise<{ answer: string, model: string, source: string, sources: Array, topic: string, isResearch: boolean }>}
 */
export async function performResearch(topic, options = {}) {
  const researchData = await conductResearch(topic, options);
  const { sources, contextSnippet, summaryAnswer } = researchData;

  const researchPrompt = `You are Afzal AI, performing comprehensive web research.
A user asked the following research question:
"${topic}"

Here are real-time web research findings retrieved via web search:
${contextSnippet}

Instructions:
1. Provide a comprehensive, accurate, and direct response answering the user's question based on these findings in a natural conversational tone.
2. Use clean structure (bullet points or numbered points) when it genuinely improves readability for multiple findings, without unnecessary bolding on individual words.
3. Cite sources naturally using the provided findings and URLs.
4. Keep the tone knowledgeable, objective, and conversational.`;

  const geminiResult = await callGeminiWithFallback(
    [{ role: 'user', parts: [{ text: researchPrompt }] }],
    { modelTier: options.modelTier }
  );

  if (geminiResult) {
    return {
      answer: cleanConversationalFormatting(geminiResult.answer, topic),
      model: `${geminiResult.model} Research`,
      source: 'tavily-web-research',
      sources,
      topic,
      isResearch: true
    };
  }

  // Fallback to Tavily's built-in AI answer if Gemini is unavailable
  return {
    answer: cleanConversationalFormatting(summaryAnswer || (sources.length > 0 ? sources[0].snippet : "Research completed, but no detailed summary could be synthesized."), topic),
    model: 'tavily-search-agent',
    source: 'tavily-direct',
    sources,
    topic,
    isResearch: true
  };
}

/**
 * Generates an AI answer for the user's question using a sensible decision hierarchy:
 * 1. Web research when current live info or explicit web search is requested.
 * 2. Document RAG when uploaded PDF/doc is explicitly referenced or pinned.
 * 3. Platform support KB when platform policies are specifically requested.
 * 4. General-purpose direct answer (ChatGPT interaction style) for all general questions with multi-turn memory.
 * 
 * @param {string} userQuestion - The question asked by the user.
 * @param {object} options - Options including mode, userId, documentId, documentName, history, modelTier
 * @returns {Promise<{ answer: string, model: string, source: string, contextMatched?: string[], sources?: Array, isResearch?: boolean }>}
 */
export async function generateAIAnswer(userQuestion, options = {}) {
  const mode = options.mode || 'auto';
  const userId = options.userId || null;
  const documentId = options.documentId || null;
  const documentName = options.documentName || null;
  const modelTier = options.modelTier || 'flash';
  const history = options.history || [];

  // Check user uploaded documents if user is authenticated
  let userDocs = [];
  if (userId && userId !== 'guest') {
    try {
      userDocs = await getUserDocuments(userId);
    } catch (e) {
      console.warn('[AIService] Failed to check user documents:', e.message);
    }
  }

  // -------------------------------------------------------------
  // 1. DECISION HIERARCHY: Web Research
  // -------------------------------------------------------------
  if (isWebResearchRequest(userQuestion, { mode, documentId })) {
    try {
      console.log(`[AIService] Routing to Web Research for: "${userQuestion}"`);
      return await performResearch(userQuestion, { modelTier });
    } catch (err) {
      console.warn('[AIService] Web research notice, proceeding with direct AI reasoning:', err.message);
    }
  }

  // -------------------------------------------------------------
  // 2. DECISION HIERARCHY: Document Grounding (PDF / RAG)
  // -------------------------------------------------------------
  if (isDocumentRequest(userQuestion, { mode, documentId, documentName })) {
    console.log(`[AIService] Document intent detected for: "${userQuestion}" (userId: ${userId}, docsCount: ${userDocs.length})`);

    // Case A: User explicitly asks about a PDF, but has no uploaded documents
    if (userDocs.length === 0 && !documentId) {
      const noDocContext = `[System Notice: The user's query refers to an uploaded PDF or document, but no PDF has been uploaded to their account in this session yet. Inform the user politely and naturally that no PDF has been uploaded yet, and invite them to upload or drag-and-drop a document so you can analyze it. Also answer any general aspect of their question.]`;
      const noDocContents = buildGeminiContents(userQuestion, history, noDocContext);
      const res = await callGeminiWithFallback(noDocContents, { modelTier });
      if (res) {
        return {
          answer: cleanConversationalFormatting(res.answer, userQuestion),
          model: res.model,
          source: 'gemini-direct',
          sources: []
        };
      }
    }

    // Case B: Search user's isolated Pinecone namespace for relevant document excerpts
    const matches = await searchUserDocuments(userQuestion, {
      topK: 4,
      userId,
      documentId,
      minScore: 0.38
    });

    let docContext = '';
    let sources = [];
    const matchedTitles = [];

    if (matches.length > 0) {
      docContext = matches
        .map(m => `[Document Excerpt from "${m.title}" | Page ${m.pageNumber || 1}]:\n${m.content}`)
        .join('\n\n');
      matchedTitles.push(...new Set(matches.map(m => m.title)));
      sources = matches.map(m => ({
        id: m.id,
        title: m.title,
        snippet: m.content ? m.content.slice(0, 200) + '...' : '',
        score: m.score,
        source: 'user-document',
        pageNumber: m.pageNumber,
        chunkIndex: m.chunkIndex
      }));
    } else if (userDocs.length > 0) {
      // Fallback for broad/summary queries like "Explain the PDF I uploaded" or "Summarize the file"
      const targetDocMeta = documentId
        ? userDocs.find(d => (d._id || d.id) === documentId.toString())
        : userDocs[0];

      if (targetDocMeta) {
        matchedTitles.push(targetDocMeta.originalName);
        try {
          const fullDoc = await getDocumentById(userId, targetDocMeta._id || targetDocMeta.id);
          if (fullDoc && fullDoc.chunks && fullDoc.chunks.length > 0) {
            const initialChunks = fullDoc.chunks.slice(0, 4);
            docContext = initialChunks
              .map(c => `[Document Excerpt from "${targetDocMeta.originalName}" | Page ${c.pageNumber || 1}]:\n${c.text}`)
              .join('\n\n');
            sources = initialChunks.map(c => ({
              id: c.vectorId || `${targetDocMeta.id}_c${c.chunkIndex}`,
              title: targetDocMeta.originalName,
              snippet: c.text.slice(0, 200) + '...',
              score: 0.85,
              source: 'user-document',
              pageNumber: c.pageNumber,
              chunkIndex: c.chunkIndex
            }));
          }
        } catch (e) {
          console.warn('[AIService] Failed to load full document fallback:', e.message);
        }
      }
    }

    if (docContext) {
      const promptSnippet = `Retrieved Document Excerpts from user's uploaded files:\n${docContext}\n\nInstructions: Answer the user's question accurately using these document excerpts in a natural conversational tone. Cite the document title and page number where appropriate. If the excerpts do not contain the answer, state that clearly and use your general knowledge if helpful while clearly distinguishing the two.`;
      const docContents = buildGeminiContents(userQuestion, history, promptSnippet);
      const geminiResult = await callGeminiWithFallback(docContents, { modelTier });

      if (geminiResult) {
        return {
          answer: cleanConversationalFormatting(geminiResult.answer, userQuestion),
          model: geminiResult.model,
          source: 'gemini + user-document',
          contextMatched: matchedTitles,
          sources
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 3. DECISION HIERARCHY: Platform Policies / Support Knowledge Base
  // -------------------------------------------------------------
  if (isCompanySupportRequest(userQuestion)) {
    console.log(`[AIService] Platform policy query detected: "${userQuestion}"`);
    const kbMatches = await searchKnowledgeBase(userQuestion, {
      topK: 3,
      includeSharedKB: true,
      minScore: 0.40
    });

    if (kbMatches.length > 0) {
      const kbContext = kbMatches
        .map(m => `[Policy/Knowledge Article: "${m.title}"]:\n${m.content}`)
        .join('\n\n');
      const kbSources = kbMatches.map(m => ({
        id: m.id,
        title: m.title,
        snippet: m.content ? m.content.slice(0, 200) + '...' : '',
        score: m.score,
        source: 'pinecone-vector-db'
      }));

      const kbPrompt = `Knowledge Base Information:\n${kbContext}\n\nInstructions: Answer the user's question accurately and helpfully based on the above information in a conversational manner.`;
      const kbContents = buildGeminiContents(userQuestion, history, kbPrompt);
      const geminiResult = await callGeminiWithFallback(kbContents, { modelTier });

      if (geminiResult) {
        return {
          answer: cleanConversationalFormatting(geminiResult.answer, userQuestion),
          model: geminiResult.model,
          source: 'gemini + pinecone',
          contextMatched: kbMatches.map(m => m.title),
          sources: kbSources
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 4. DECISION HIERARCHY: Direct General-Purpose AI Assistant (Default)
  // -------------------------------------------------------------
  // No RAG injection, no unnecessary web search. Multi-turn conversation context included.
  const directContents = buildGeminiContents(userQuestion, history);
  const geminiResult = await callGeminiWithFallback(directContents, { modelTier });

  if (geminiResult) {
    return {
      answer: cleanConversationalFormatting(geminiResult.answer, userQuestion),
      model: geminiResult.model,
      source: 'gemini-direct',
      sources: []
    };
  }

  // -------------------------------------------------------------
  // 5. OpenAI API Key fallback if configured
  // -------------------------------------------------------------
  if (OPENAI_API_KEY && OPENAI_API_KEY !== 'your_openai_api_key_here') {
    try {
      const openAiMessages = [
        { role: 'system', content: DEFAULT_SYSTEM_INSTRUCTION },
        ...history.slice(-6).map(m => ({
          role: (m.role === 'assistant' || m.role === 'model') ? 'assistant' : 'user',
          content: m.content || m.text || ''
        })),
        { role: 'user', content: userQuestion }
      ];

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: openAiMessages,
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (response.ok) {
        const data = await response.json();
        const replyText = data.choices?.[0]?.message?.content;
        if (replyText) {
          return {
            answer: cleanConversationalFormatting(replyText.trim(), userQuestion),
            model: 'gpt-4o-mini',
            source: 'openai-direct',
            sources: []
          };
        }
      }
    } catch (err) {
      console.error('[AIService] OpenAI fallback notice:', err.message);
    }
  }

  // -------------------------------------------------------------
  // 6. Graceful resilient fallback
  // -------------------------------------------------------------
  return {
    answer: "I apologize, but I am experiencing a temporary connection delay with the AI service. Please send your question again in a moment.",
    model: 'afzal-ai-core',
    source: 'system',
    sources: []
  };
}

export default {
  generateAIAnswer,
  performResearch,
  buildGeminiContents,
  callGeminiWithFallback,
  isWebResearchRequest,
  isDocumentRequest,
  isCompanySupportRequest,
  cleanConversationalFormatting
};
