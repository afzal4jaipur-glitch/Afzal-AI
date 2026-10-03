import mongoose from 'mongoose';

const DocumentChunkSchema = new mongoose.Schema({
  chunkIndex: {
    type: Number,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  vectorId: {
    type: String,
    required: true
  },
  pageNumber: {
    type: Number,
    default: 1
  }
});

const DocumentSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  mimeType: {
    type: String,
    default: 'application/pdf'
  },
  size: {
    type: Number,
    required: true
  },
  pageCount: {
    type: Number,
    default: 1
  },
  chunkCount: {
    type: Number,
    default: 0
  },
  chunks: [DocumentChunkSchema],
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  bufferCommands: false
});

export const Document = mongoose.model('Document', DocumentSchema);
export default Document;

