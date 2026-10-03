import 'dotenv/config';
import mongoose from 'mongoose';
import Message, { Conversation } from '../models/Conversation.js';

// Disable command buffering so queries fail immediately instead of hanging when disconnected
mongoose.set('bufferCommands', false);

let isDbConnected = false;

// In-memory fallback caches if MongoDB is disconnected
const memoryConversations = new Map(); // key: `${userId}:${sessionId}` -> conv object
const memoryMessages = []; // list of message objects

function generateCleanTitle(text = '') {
  const clean = text.replace(/^[#\s?!*–-]+/, '').trim();
  if (!clean) return 'New chat';
  return clean.length > 32 ? clean.substring(0, 32).trim() + '...' : clean;
}

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
 * Saves a single message to MongoDB and updates the corresponding conversation.
 */
export async function saveMessage(data) {
  const userId = data.userId ? data.userId.toString() : 'guest';
  const sessionId = data.sessionId || 'default-session';

  // 1. Update/Upsert conversation record
  try {
    if (isDbConnected) {
      let existingConv = await Conversation.findOne({ userId, sessionId });
      if (!existingConv) {
        const title = data.role === 'user' ? generateCleanTitle(data.content) : 'New chat';
        await Conversation.create({
          userId,
          sessionId,
          title,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      } else {
        const updates = { updatedAt: new Date() };
        if (data.role === 'user' && (!existingConv.title || existingConv.title === 'New chat')) {
          updates.title = generateCleanTitle(data.content);
        }
        await Conversation.updateOne({ userId, sessionId }, { $set: updates });
      }
    }
  } catch (convErr) {
    console.warn('[DBService] Notice updating conversation metadata:', convErr.message);
  }

  // Memory fallback for conversation
  const memKey = `${userId}:${sessionId}`;
  if (!memoryConversations.has(memKey)) {
    memoryConversations.set(memKey, {
      id: sessionId,
      sessionId,
      userId,
      title: data.role === 'user' ? generateCleanTitle(data.content) : 'New chat',
      createdAt: new Date(),
      updatedAt: new Date()
    });
  } else {
    const existing = memoryConversations.get(memKey);
    existing.updatedAt = new Date();
    if (data.role === 'user' && (!existing.title || existing.title === 'New chat')) {
      existing.title = generateCleanTitle(data.content);
    }
  }

  // 2. Save Message
  if (!isDbConnected) {
    const memMsg = {
      _id: 'mem_' + Date.now() + Math.random().toString(36).substr(2, 4),
      userId,
      sessionId,
      role: data.role,
      content: data.content,
      mode: data.mode || 'auto',
      source: data.source,
      model: data.model,
      sources: data.sources || [],
      contextMatched: data.contextMatched || [],
      createdAt: new Date()
    };
    memoryMessages.push(memMsg);
    return memMsg;
  }

  try {
    const msg = new Message({
      userId,
      sessionId,
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
  let query = {};
  let limit = limitParam;

  if (typeof options === 'string') {
    query.sessionId = options;
  } else if (typeof options === 'object') {
    if (options.userId) {
      query.userId = options.userId.toString();
    }
    if (options.sessionId) {
      query.sessionId = options.sessionId;
    }
    if (options.limit) {
      limit = options.limit;
    }
  }

  if (isDbConnected) {
    try {
      const messages = await Message.find(query)
        .sort({ createdAt: 1 })
        .limit(limit)
        .lean();
      return messages;
    } catch (err) {
      console.warn('[DBService] Error retrieving history from MongoDB:', err.message);
    }
  }

  // Fallback to memory
  return memoryMessages
    .filter(m => (!query.userId || m.userId === query.userId) && (!query.sessionId || m.sessionId === query.sessionId))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(-limit);
}

/**
 * Retrieves all conversations belonging to a user, recent first.
 */
export async function getUserConversations(userId = 'guest') {
  const uid = userId ? userId.toString() : 'guest';

  if (isDbConnected) {
    try {
      const convs = await Conversation.find({ userId: uid })
        .sort({ updatedAt: -1 })
        .lean();
      return convs.map(c => ({
        id: c.sessionId,
        sessionId: c.sessionId,
        title: c.title,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt
      }));
    } catch (err) {
      console.warn('[DBService] Error retrieving conversations from MongoDB:', err.message);
    }
  }

  // Fallback to memory
  const results = [];
  for (const [key, conv] of memoryConversations.entries()) {
    if (conv.userId === uid) {
      results.push(conv);
    }
  }
  return results.sort((a, b) => b.updatedAt - a.updatedAt);
}

/**
 * Updates a conversation title for a user.
 */
export async function updateConversationTitle(userId, sessionId, title) {
  const uid = userId ? userId.toString() : 'guest';
  const cleanTitle = (title || 'New chat').trim();

  if (isDbConnected) {
    try {
      await Conversation.updateOne(
        { userId: uid, sessionId },
        { $set: { title: cleanTitle, updatedAt: new Date() } }
      );
    } catch (err) {
      console.warn('[DBService] Error updating title in MongoDB:', err.message);
    }
  }

  const memKey = `${uid}:${sessionId}`;
  if (memoryConversations.has(memKey)) {
    const c = memoryConversations.get(memKey);
    c.title = cleanTitle;
    c.updatedAt = new Date();
  }

  return { success: true, sessionId, title: cleanTitle };
}

/**
 * Deletes a conversation and its messages belonging to a user.
 */
export async function deleteUserConversation(userId, sessionId) {
  const uid = userId ? userId.toString() : 'guest';

  if (isDbConnected) {
    try {
      await Conversation.deleteOne({ userId: uid, sessionId });
      await Message.deleteMany({ userId: uid, sessionId });
    } catch (err) {
      console.warn('[DBService] Error deleting conversation in MongoDB:', err.message);
    }
  }

  const memKey = `${uid}:${sessionId}`;
  memoryConversations.delete(memKey);
  for (let i = memoryMessages.length - 1; i >= 0; i--) {
    if (memoryMessages[i].userId === uid && memoryMessages[i].sessionId === sessionId) {
      memoryMessages.splice(i, 1);
    }
  }

  return { success: true, sessionId };
}

/**
 * Clears all conversations and messages for a user.
 */
export async function clearAllUserConversations(userId) {
  const uid = userId ? userId.toString() : 'guest';

  if (isDbConnected) {
    try {
      await Conversation.deleteMany({ userId: uid });
      await Message.deleteMany({ userId: uid });
    } catch (err) {
      console.warn('[DBService] Error clearing all conversations in MongoDB:', err.message);
    }
  }

  for (const [key, conv] of memoryConversations.entries()) {
    if (conv.userId === uid) memoryConversations.delete(key);
  }
  for (let i = memoryMessages.length - 1; i >= 0; i--) {
    if (memoryMessages[i].userId === uid) memoryMessages.splice(i, 1);
  }

  return { success: true };
}

/**
 * Clears messages for a session or user.
 */
export async function clearSessionHistory(options = 'default-session') {
  let query = {};
  if (typeof options === 'string') {
    query.sessionId = options;
  } else if (typeof options === 'object') {
    if (options.userId) query.userId = options.userId.toString();
    if (options.sessionId) query.sessionId = options.sessionId;
  }

  if (isDbConnected) {
    try {
      await Message.deleteMany(query);
      return true;
    } catch (err) {
      console.warn('[DBService] Error clearing history from MongoDB:', err.message);
      return false;
    }
  }

  for (let i = memoryMessages.length - 1; i >= 0; i--) {
    const m = memoryMessages[i];
    if ((!query.userId || m.userId === query.userId) && (!query.sessionId || m.sessionId === query.sessionId)) {
      memoryMessages.splice(i, 1);
    }
  }
  return true;
}

export function isConnected() {
  return isDbConnected;
}

export default {
  connectDB,
  saveMessage,
  getSessionHistory,
  getUserConversations,
  updateConversationTitle,
  deleteUserConversation,
  clearAllUserConversations,
  clearSessionHistory,
  isConnected
};
