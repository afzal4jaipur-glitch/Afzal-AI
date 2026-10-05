import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import { clerkMiddleware } from '@clerk/express';
import Document from './models/Document.js';
import { requireAuth, optionalAuth } from './middleware/authMiddleware.js';
import {
  embedAndUpsertDocument,
  getUserDocuments,
  getDocumentById,
  deleteUserDocument
} from './services/documentService.js';
import { generateAIAnswer, performResearch } from './services/aiService.js';
import {
  connectDB,
  saveMessage,
  getSessionHistory,
  clearSessionHistory,
  getUserConversations,
  updateConversationTitle,
  deleteUserConversation,
  clearAllUserConversations,
  isConnected as isMongoConnected
} from './services/dbService.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_support_agent_key_2026_x99';

// Configure multer for memory storage (max 15MB PDF files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF documents are supported. Please upload a .pdf file.'));
    }
  }
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    // Allow any localhost or 127.0.0.1 port (5173, 5174, 3000, etc.)
    if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-id']
}));
app.use(express.json());
app.use(clerkMiddleware());

// Initialize MongoDB on startup
connectDB();

// -------------------------------------------------------------
// HEALTH CHECK
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'Afzal AI Assistant - General-Purpose AI, Web Research & PDF RAG Backend',
    features: {
      llm: 'Gemini Multi-Model (Adaptive Fallback)',
      vectorDb: 'Pinecone Knowledge Base (Multi-Tenant Namespaces)',
      webResearch: 'Tavily AI Search',
      auth: 'Clerk Authentication',
      pdfRag: 'PDF Ingestion & Embeddings',
      database: isMongoConnected() ? 'MongoDB Atlas (Connected)' : 'MongoDB Atlas (Disconnected)'
    },
    timestamp: new Date().toISOString()
  });
});

// -------------------------------------------------------------
// AUTHENTICATION ROUTES (Clerk Integration)
// -------------------------------------------------------------
app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    res.status(200).json({
      user: {
        id: req.user.userId,
        userId: req.user.userId,
        name: req.user.name || 'User',
        email: req.user.email || '',
        avatar: req.user.avatar || '',
        createdAt: new Date()
      }
    });
  } catch (error) {
    console.error('Fetch user error:', error);
    res.status(500).json({ error: 'Failed to retrieve user profile.' });
  }
});

// -------------------------------------------------------------
// DOCUMENT MANAGEMENT ROUTES (PDF Upload, Ingest, List, Delete)
// -------------------------------------------------------------
app.post('/api/documents/upload', optionalAuth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded. Please attach a file.' });
    }

    const userId = req.user?.userId || req.headers['x-guest-id'] || 'guest';
    const originalName = req.file.originalname;
    const buffer = req.file.buffer;
    const size = req.file.size;

    console.log(`[POST /api/documents/upload] User "${userId}" uploading "${originalName}" (${size} bytes)`);

    const document = await embedAndUpsertDocument(userId, originalName, buffer, size);

    res.status(201).json({
      success: true,
      message: `Document "${originalName}" parsed, embedded, and indexed into ${userId === 'guest' ? 'guest' : 'personal'} namespace successfully!`,
      document
    });
  } catch (error) {
    console.error('PDF upload & ingestion error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process and index PDF document.'
    });
  }
});

app.get('/api/documents', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-guest-id'] || 'guest';
    const documents = await getUserDocuments(userId);
    res.status(200).json({
      success: true,
      count: documents.length,
      documents
    });
  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ error: 'Failed to retrieve documents.' });
  }
});

app.get('/api/documents/:id', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-guest-id'] || 'guest';
    const documentId = req.params.id;
    const document = await getDocumentById(userId, documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    res.status(200).json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Fetch document detail error:', error);
    res.status(500).json({ error: 'Failed to retrieve document details.' });
  }
});

app.delete('/api/documents/:id', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId || req.headers['x-guest-id'] || 'guest';
    const documentId = req.params.id;

    await deleteUserDocument(userId, documentId);

    res.status(200).json({
      success: true,
      message: 'Document and its vector embeddings deleted successfully.'
    });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: error.message || 'Failed to delete document.' });
  }
});

// -------------------------------------------------------------
// CHAT API (General-Purpose AI Assistant + PDF RAG + Web Research)
// -------------------------------------------------------------
const handleChat = async (req, res) => {
  try {
    const question = req.body.message || req.body.question;
    const mode = req.body.mode || 'auto'; // 'auto' | 'research' | 'support'
    // Support both authenticated Clerk users and guest users
    const userId = req.user ? req.user.userId : (req.headers['x-guest-id'] || 'guest');
    const sessionId = req.body.sessionId || (userId !== 'guest' ? `user_${userId}` : 'default-session');
    const documentId = req.body.documentId || null;
    const documentName = req.body.documentName || null;
    const modelTier = req.body.modelTier || 'flash';
    let history = Array.isArray(req.body.history) ? req.body.history : [];

    if (!question || typeof question !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "message" field in request body.'
      });
    }

    console.log(`[POST /api/chat] [User: ${userId}] [Mode: ${mode}] [Doc: ${documentName || 'none'}] [Session: ${sessionId}] User: "${question}"`);

    // 1. If history was not supplied in the payload, load past conversation turns from MongoDB
    if (history.length === 0 && isMongoConnected()) {
      try {
        const pastDocs = await getSessionHistory({ sessionId, userId, limit: 10 });
        history = pastDocs.map(m => ({
          role: m.role,
          content: m.content
        }));
      } catch (histErr) {
        console.warn('[server.js] Could not load past conversation history:', histErr.message);
      }
    }

    // 2. Persist Current User Message to MongoDB
    await saveMessage({
      userId,
      sessionId,
      role: 'user',
      content: question,
      mode
    });

    // 3. Call AI Service with full conversational context and decision hierarchy
    const aiResult = await generateAIAnswer(question, {
      mode,
      userId,
      sessionId,
      documentId,
      documentName,
      modelTier,
      history
    });
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    console.log(`[POST /api/chat] AI Answer Generated (Source: ${aiResult.source}, Model: ${aiResult.model}, Sources: ${aiResult.sources?.length || 0})`);

    // 4. Persist Assistant Message to MongoDB
    await saveMessage({
      userId,
      sessionId,
      role: 'assistant',
      content: aiResult.answer,
      mode,
      source: aiResult.source,
      model: aiResult.model,
      sources: aiResult.sources || [],
      contextMatched: aiResult.contextMatched || []
    });

    res.status(200).json({
      reply: aiResult.answer,
      model: aiResult.model,
      source: aiResult.source,
      sources: aiResult.sources || [],
      contextMatched: aiResult.contextMatched || [],
      isResearch: !!aiResult.isResearch,
      timestamp,
      query: question
    });
  } catch (error) {
    console.error('Error handling chat request:', error);
    res.status(500).json({
      error: 'Internal server error while processing AI chat request.'
    });
  }
};

app.post('/api/chat', optionalAuth, handleChat);
app.post('/chat', optionalAuth, handleChat);

// -------------------------------------------------------------
// DEDICATED RESEARCH ENDPOINT (Tavily AI Web Search)
// -------------------------------------------------------------
app.post('/api/research', optionalAuth, async (req, res) => {
  try {
    const { topic, options = {} } = req.body;
    const userId = req.user ? req.user.userId : 'guest';
    const sessionId = req.body.sessionId || (userId !== 'guest' ? `user_${userId}` : 'default-session');

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({
        error: 'Missing or invalid "topic" field in request body.'
      });
    }

    console.log(`[POST /api/research] User: ${userId} Topic: "${topic}"`);

    await saveMessage({
      userId,
      sessionId,
      role: 'user',
      content: `[Research Request] ${topic}`,
      mode: 'research'
    });

    const researchResult = await performResearch(topic, options);
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await saveMessage({
      userId,
      sessionId,
      role: 'assistant',
      content: researchResult.answer,
      mode: 'research',
      source: researchResult.source,
      model: researchResult.model,
      sources: researchResult.sources || []
    });

    res.status(200).json({
      topic,
      reply: researchResult.answer,
      model: researchResult.model,
      source: researchResult.source,
      sources: researchResult.sources || [],
      timestamp
    });
  } catch (error) {
    console.error('Error handling research request:', error);
    res.status(500).json({
      error: 'Internal server error while processing web research request.'
    });
  }
});

// -------------------------------------------------------------
// MULTI-USER CONVERSATION ENDPOINTS
// -------------------------------------------------------------
app.get('/api/conversations', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : 'guest';
    const conversations = await getUserConversations(userId);
    res.status(200).json({
      success: true,
      count: conversations.length,
      conversations
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to retrieve conversations.' });
  }
});

app.patch('/api/conversations/:sessionId', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : 'guest';
    const { sessionId } = req.params;
    const { title } = req.body;
    const result = await updateConversationTitle(userId, sessionId, title);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error updating conversation title:', error);
    res.status(500).json({ error: 'Failed to update conversation title.' });
  }
});

app.delete('/api/conversations/:sessionId', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : 'guest';
    const { sessionId } = req.params;
    const result = await deleteUserConversation(userId, sessionId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation.' });
  }
});

app.delete('/api/conversations', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : 'guest';
    await clearAllUserConversations(userId);
    res.status(200).json({
      success: true,
      message: 'All conversations and messages cleared for user.'
    });
  } catch (error) {
    console.error('Error clearing conversations:', error);
    res.status(500).json({ error: 'Failed to clear conversations.' });
  }
});

// -------------------------------------------------------------
// CHAT HISTORY ENDPOINTS (MongoDB Atlas)
// -------------------------------------------------------------
app.get('/api/history', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : 'guest';
    const sessionId = req.query.sessionId || (userId !== 'guest' ? `user_${userId}` : 'default-session');
    const limit = parseInt(req.query.limit, 10) || 50;

    const history = await getSessionHistory({ sessionId, userId, limit });

    const formatted = history.map((msg) => ({
      id: msg._id,
      role: msg.role,
      text: msg.content,
      mode: msg.mode,
      source: msg.source,
      model: msg.model,
      sources: msg.sources || [],
      contextMatched: msg.contextMatched || [],
      time: new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }));

    res.status(200).json({
      sessionId,
      userId: userId || 'guest',
      count: formatted.length,
      messages: formatted
    });
  } catch (error) {
    console.error('Error fetching chat history:', error);
    res.status(500).json({ error: 'Failed to retrieve chat history.' });
  }
});

app.delete('/api/history', optionalAuth, async (req, res) => {
  try {
    const userId = req.user ? req.user.userId : 'guest';
    const sessionId = req.query.sessionId || (userId !== 'guest' ? `user_${userId}` : 'default-session');

    await clearSessionHistory({ sessionId, userId });

    res.status(200).json({
      success: true,
      message: `Chat history cleared for session "${sessionId}".`
    });
  } catch (error) {
    console.error('Error clearing chat history:', error);
    res.status(500).json({ error: 'Failed to clear chat history.' });
  }
});

// Default Route
app.get('/', (req, res) => {
  res.send('AI Support, Web Research & PDF Multi-Tenant Agent Backend is running.');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Support, Research & PDF Agent Backend running at http://localhost:${PORT}`);
  console.log(`🔐 Auth API: http://localhost:${PORT}/api/auth`);
  console.log(`📁 Documents API: http://localhost:${PORT}/api/documents`);
  console.log(`🤖 AI Chat API: http://localhost:${PORT}/api/chat`);
  console.log(`🌐 Web Research API: http://localhost:${PORT}/api/research`);
  console.log(`📜 History API: http://localhost:${PORT}/api/history`);
  console.log(`💓 Health check: http://localhost:${PORT}/api/health`);
});
