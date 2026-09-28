import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  userId: {
    type: String,
    default: 'guest',
    index: true
  },
  sessionId: {
    type: String,
    default: 'default-session',
    index: true
  },
  role: {
    type: String,
    enum: ['user', 'assistant', 'system'],
    required: true
  },
  content: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    enum: ['support', 'research', 'hybrid', 'auto'],
    default: 'auto'
  },
  source: {
    type: String,
    default: 'direct'
  },
  model: {
    type: String,
    default: "Afzal's AI"
  },
  sources: [
    {
      id: String,
      title: String,
      url: String,
      snippet: String,
      score: Number
    }
  ],
  contextMatched: [String],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

export const Message = mongoose.model('Message', MessageSchema);
export default Message;
