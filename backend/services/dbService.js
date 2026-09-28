import 'dotenv/config';
import mongoose from 'mongoose';
import Message from '../models/Conversation.js';

// Disable command buffering so queries fail immediately instead of hanging when disconnected
mongoose.set('bufferCommands', false);

let isDbConnected = false;

/**
 * Connects to MongoDB Atlas using the URI from environment variables.
 */
export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  if (!uri || uri.includes('your_username_here')) {
    console.warn('[DBService] MONGODB_URI is not configured in .env. Database persistence disabled.');
    return false;
  }

  try {
    console.log('[DBService] Connecting to MongoDB Atlas...');
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
    });
    isDbConnected = true;
    console.log('✅ [DBService] Connected to MongoDB Atlas successfully! (Stage 5 Completed)');
    return true;
  } catch (err) {
    console.warn('⚠️ [DBService] MongoDB connection notice:', err.message);
    isDbConnected = false;

    // Retry connection in background every 30 seconds in case IP whitelist is updated
    setTimeout(() => {
      if (!isDbConnected) {
        console.log('[DBService] Retrying MongoDB Atlas connection...');
        connectDB();
      }
    }, 30000);

    return false;
  }
}

/**
 * Saves a single message to MongoDB.
 */
export async function saveMessage(data) {
  if (!isDbConnected) return null;
  try {
    const msg = new Message({
      userId: data.userId || 'guest',
      sessionId: data.sessionId || 'default-session',
      role: data.role,
      content: data.content,
      mode: data.mode || 'auto',
      source: data.source,
      model: data.model,
      sources: data.sources || [],
      contextMatched: data.contextMatched || []
    });
    return await msg.save();
  } catch (err) {
    console.warn('[DBService] Error saving message to MongoDB:', err.message);
    return null;
  }
}

/**
 * Retrieves chat history for a session/user ordered by creation time.
 */
export async function getSessionHistory(options = 'default-session', limitParam = 50) {
  if (!isDbConnected) return [];
  try {
    let query = {};
    let limit = limitParam;

    if (typeof options === 'string') {
      query.sessionId = options;
    } else if (typeof options === 'object') {
      if (options.userId) {
        query.userId = options.userId;
      }
      if (options.sessionId) {
        query.sessionId = options.sessionId;
      }
      if (options.limit) {
        limit = options.limit;
      }
    }

    const messages = await Message.find(query)
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();
    return messages;
  } catch (err) {
    console.warn('[DBService] Error retrieving history from MongoDB:', err.message);
    return [];
  }
}

/**
 * Clears messages for a session or user.
 */
export async function clearSessionHistory(options = 'default-session') {
  if (!isDbConnected) return false;
  try {
    let query = {};
    if (typeof options === 'string') {
      query.sessionId = options;
    } else if (typeof options === 'object') {
      if (options.userId) query.userId = options.userId;
      if (options.sessionId) query.sessionId = options.sessionId;
    }
    await Message.deleteMany(query);
    return true;
  } catch (err) {
    console.warn('[DBService] Error clearing history from MongoDB:', err.message);
    return false;
  }
}

export function isConnected() {
  return isDbConnected;
}

export default {
  connectDB,
  saveMessage,
  getSessionHistory,
  clearSessionHistory,
  isConnected
};
