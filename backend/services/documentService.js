import mongoose from 'mongoose';
import { PDFParse } from 'pdf-parse';
import { GoogleGenAI } from '@google/genai';
import Document from '../models/Document.js';
import { getQueryEmbedding, getBatchEmbeddings, getPineconeIndex } from './pineconeService.js';

// In-memory document fallback store if MongoDB is connecting/offline
const memoryDocuments = new Map();

/**
 * Splits text into overlapping chunks.
 * 
 * @param {string} text 
 * @param {number} chunkSize 
 * @param {number} overlap 
 * @param {number} pageNumber 
 * @returns {Array<{ text: string, pageNumber: number }>}
 */
function chunkText(text, chunkSize = 1200, overlap = 150, pageNumber = 1) {
  const chunks = [];
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return chunks;

  let start = 0;
  while (start < clean.length) {
    let end = start + chunkSize;
    if (end < clean.length) {
      const nextSpace = clean.lastIndexOf(' ', end);
      const nextNewline = clean.lastIndexOf('\n', end);
      const breakPoint = Math.max(nextSpace, nextNewline);
      if (breakPoint > start + chunkSize * 0.6) {
        end = breakPoint;
      }
    } else {
      end = clean.length;
    }

    const chunkStr = clean.substring(start, end).trim();
    if (chunkStr.length > 20) {
      chunks.push({
        text: chunkStr,
        pageNumber
      });
    }

    if (end >= clean.length) break;
    start = end - overlap;
  }

  return chunks;
}

/**
 * Extracts text from a PDF buffer and splits it into indexed chunks.
 * If the PDF is scanned or image-based, falls back to Gemini Multimodal OCR.
 * 
 * @param {Buffer} buffer - Raw file buffer
 * @param {string} originalName - Document filename
 * @returns {Promise<{ chunks: Array<{ chunkIndex: number, text: string, pageNumber: number }>, pageCount: number }>}
 */
export async function parseAndChunkPDF(buffer, originalName = 'Document.pdf') {
  let chunks = [];
  let pageCount = 1;

  try {
    const parser = new PDFParse({ data: buffer });
    const textResult = await parser.getText();
    
    if (textResult.pages && textResult.pages.length > 0) {
      pageCount = textResult.pages.length;
      textResult.pages.forEach((page) => {
        const pageChunks = chunkText(page.text || '', 1200, 150, page.num);
        pageChunks.forEach((c) => chunks.push(c));
      });
    } else if (textResult.text) {
      const rawChunks = chunkText(textResult.text, 1200, 150, 1);
      rawChunks.forEach((c) => chunks.push(c));
    }
  } catch (pdfErr) {
    console.warn(`[DocumentService] PDFParse notice for "${originalName}":`, pdfErr.message);
  }

  // If no digital text extracted (scanned/image PDF), attempt Gemini OCR transcription
  if (chunks.length === 0 && process.env.GEMINI_API_KEY) {
    try {
      console.log(`[DocumentService] No text stream found in "${originalName}". Attempting Gemini OCR transcription...`);
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const ocrRes = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  data: buffer.toString('base64'),
                  mimeType: 'application/pdf'
                }
              },
              {
                text: 'Extract and transcribe all text, numbers, certificates, signatures, stamps, tables, and notes from this document into clear readable text.'
              }
            ]
          }
        ]
      });

      const ocrText = ocrRes.text || ocrRes.candidates?.[0]?.content?.parts?.[0]?.text;
      if (ocrText && ocrText.trim().length > 10) {
        console.log(`[DocumentService] Gemini OCR succeeded for "${originalName}" (${ocrText.length} characters).`);
        const ocrChunks = chunkText(ocrText, 1200, 150, 1);
        ocrChunks.forEach((c) => chunks.push(c));
      }
    } catch (ocrErr) {
      console.warn('[DocumentService] Gemini OCR notice:', ocrErr.message);
    }
  }

  // If still empty (e.g. blank document or unparseable), create fallback metadata chunk so upload never crashes
  if (chunks.length === 0) {
    chunks.push({
      text: `Document: "${originalName}". This file was indexed as a document record (${pageCount} page(s), ${(buffer.length / 1024).toFixed(1)} KB).`,
      pageNumber: 1
    });
  }

  // Limit chunks to max 50 to prevent rate-limit bottlenecks and ensure fast uploads
  const maxChunks = 50;
  const limitedChunks = chunks.length > maxChunks ? chunks.slice(0, maxChunks) : chunks;

  // Format with zero-based sequential chunkIndex
  const formattedChunks = limitedChunks.map((c, index) => ({
    chunkIndex: index,
    text: c.text,
    pageNumber: c.pageNumber || 1
  }));

  return {
    chunks: formattedChunks,
    pageCount
  };
}

/**
 * Ingests a PDF document for a specific user:
 * 1. Parses and chunks PDF (with OCR fallback for scanned docs)
 * 2. Generates batched embeddings with Gemini
 * 3. Upserts vectors to user's isolated Pinecone namespace ("user_<userId>")
 * 4. Saves document record and chunks to MongoDB
 * 
 * @param {string} userId - Authenticated user ID
 * @param {string} originalName - Filename
 * @param {Buffer} buffer - File buffer
 * @param {number} size - File size in bytes
 * @returns {Promise<Object>} Created document metadata
 */
export async function embedAndUpsertDocument(userId, originalName, buffer, size) {
  console.log(`[DocumentService] Ingesting PDF "${originalName}" for user "${userId}" (${(size / 1024).toFixed(1)} KB)...`);
  
  const { chunks, pageCount } = await parseAndChunkPDF(buffer, originalName);

  console.log(`[DocumentService] Extracted ${chunks.length} chunks across ${pageCount} pages for "${originalName}".`);

  const docId = new mongoose.Types.ObjectId();
  const pineconeIndex = getPineconeIndex();
  const vectors = [];
  const processedChunks = [];

  // Generate embeddings in fast batches
  const chunkTexts = chunks.map((c) => c.text);
  const embeddings = await getBatchEmbeddings(chunkTexts);

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const vectorId = `${docId}_c${i}`;
    const embedding = embeddings[i];

    if (embedding && embedding.length === 768) {
      vectors.push({
        id: vectorId,
        values: embedding,
        metadata: {
          documentId: docId.toString(),
          title: originalName,
          chunkIndex: i,
          pageNumber: chunk.pageNumber,
          content: chunk.text,
          userId: userId.toString()
        }
      });
    }

    processedChunks.push({
      chunkIndex: i,
      text: chunk.text,
      vectorId,
      pageNumber: chunk.pageNumber
    });
  }

  // Upsert to user's isolated Pinecone namespace
  if (pineconeIndex && vectors.length > 0) {
    try {
      const userNamespace = pineconeIndex.namespace(`user_${userId}`);
      console.log(`[DocumentService] Upserting ${vectors.length} vectors to Pinecone namespace "user_${userId}"...`);
      await userNamespace.upsert(vectors);
      console.log(`[DocumentService] Vectors stored successfully in Pinecone namespace "user_${userId}".`);
    } catch (pcErr) {
      console.error(`[DocumentService] Pinecone namespace upsert failed (MongoDB will serve as fallback):`, pcErr.message);
    }
  }

  // Persist document record and chunks to MongoDB
  const newDoc = {
    _id: docId.toString(),
    id: docId.toString(),
    userId: userId.toString(),
    originalName,
    size,
    pageCount,
    chunkCount: processedChunks.length,
    chunks: processedChunks,
    createdAt: new Date()
  };

  try {
    const mongoDoc = new Document(newDoc);
    await mongoDoc.save();
    console.log(`[DocumentService] Document "${originalName}" saved to MongoDB.`);
  } catch (dbErr) {
    console.warn(`[DocumentService] MongoDB save skipped, stored in memory cache:`, dbErr.message);
  }
  memoryDocuments.set(docId.toString(), newDoc);

  return {
    id: newDoc.id,
    originalName: newDoc.originalName,
    size: newDoc.size,
    pageCount: newDoc.pageCount,
    chunkCount: newDoc.chunkCount,
    createdAt: newDoc.createdAt
  };
}

/**
 * Retrieves all documents belonging to a user.
 */
export async function getUserDocuments(userId) {
  try {
    const docs = await Document.find({ userId: userId.toString() })
      .sort({ createdAt: -1 })
      .select('-chunks')
      .lean();
    if (docs && docs.length > 0) return docs;
  } catch (err) {
    console.warn('[DocumentService] MongoDB find failed, checking memory cache:', err.message);
  }

  // Fallback to memory
  return Array.from(memoryDocuments.values())
    .filter(d => d.userId === userId.toString())
    .map(({ chunks, ...rest }) => rest);
}

/**
 * Retrieves a single document by ID, including its chunks.
 */
export async function getDocumentById(userId, documentId) {
  const uid = userId ? userId.toString() : '';
  if (!uid) return null;

  let doc = null;
  try {
    doc = await Document.findOne({ _id: documentId, userId: uid }).lean();
    if (doc) return doc;
  } catch (err) {
    console.warn('[DocumentService] MongoDB findOne failed, checking memory cache:', err.message);
  }

  // Fallback to memory with strict user-level isolation
  const memDoc = memoryDocuments.get(documentId.toString());
  if (memDoc && memDoc.userId === uid) {
    return memDoc;
  }
  return null;
}

/**
 * Deletes a document, removing vectors from Pinecone namespace and record from MongoDB.
 */
export async function deleteUserDocument(userId, documentId) {
  const uid = userId ? userId.toString() : '';
  if (!uid) {
    throw new Error('Unauthorized: User identity required to delete documents.');
  }

  let doc = null;
  try {
    doc = await Document.findOne({ _id: documentId, userId: uid });
  } catch {
    doc = memoryDocuments.get(documentId.toString());
  }

  if (!doc) {
    doc = memoryDocuments.get(documentId.toString());
  }

  if (!doc || doc.userId !== uid) {
    throw new Error('Document not found or unauthorized.');
  }

  // Delete vectors from Pinecone namespace
  const pineconeIndex = getPineconeIndex();
  if (pineconeIndex && doc.chunks && doc.chunks.length > 0) {
    try {
      const vectorIds = doc.chunks.map((c) => c.vectorId).filter(Boolean);
      if (vectorIds.length > 0) {
        const userNamespace = pineconeIndex.namespace(`user_${uid}`);
        await userNamespace.deleteMany(vectorIds);
        console.log(`[DocumentService] Removed ${vectorIds.length} vectors from Pinecone namespace "user_${uid}".`);
      }
    } catch (pcErr) {
      console.warn(`[DocumentService] Pinecone vector cleanup notice:`, pcErr.message);
    }
  }

  // Delete from MongoDB and memory strictly scoped to user
  try {
    await Document.deleteOne({ _id: documentId, userId: uid });
  } catch {}
  memoryDocuments.delete(documentId.toString());
  return { success: true, id: documentId };
}

export default {
  parseAndChunkPDF,
  embedAndUpsertDocument,
  getUserDocuments,
  getDocumentById,
  deleteUserDocument
};
