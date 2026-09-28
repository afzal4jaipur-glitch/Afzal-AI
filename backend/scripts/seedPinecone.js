import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX || 'support-agent-kb';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!PINECONE_API_KEY || !GEMINI_API_KEY) {
  console.error('Missing PINECONE_API_KEY or GEMINI_API_KEY in .env');
  process.exit(1);
}

const pc = new Pinecone({ apiKey: PINECONE_API_KEY });
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function getEmbedding(text) {
  const response = await ai.models.embedContent({
    model: 'gemini-embedding-001',
    contents: text,
    config: {
      outputDimensionality: 768
    }
  });
  return response.embeddings[0].values;
}

async function seed() {
  try {
    console.log(`🌲 Connecting to Pinecone...`);
    const indexListResponse = await pc.listIndexes();
    const existingIndexes = (indexListResponse.indexes || []).map(idx => idx.name);

    if (!existingIndexes.includes(PINECONE_INDEX_NAME)) {
      console.log(`🌱 Creating serverless Pinecone index "${PINECONE_INDEX_NAME}" (dimension: 768, metric: cosine)...`);
      await pc.createIndex({
        name: PINECONE_INDEX_NAME,
        dimension: 768,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1'
          }
        }
      });
      console.log(`⏳ Waiting for index to initialize...`);
      let isReady = false;
      while (!isReady) {
        await new Promise(res => setTimeout(res, 3000));
        const desc = await pc.describeIndex(PINECONE_INDEX_NAME);
        if (desc.status?.ready) {
          isReady = true;
          console.log(`✅ Index "${PINECONE_INDEX_NAME}" is ready!`);
        } else {
          console.log(`   Status: ${desc.status?.state || 'initializing'}...`);
        }
      }
    } else {
      console.log(`✅ Pinecone index "${PINECONE_INDEX_NAME}" already exists.`);
    }

    const index = pc.index(PINECONE_INDEX_NAME);

    // Load Knowledge Base
    const kbPath = path.join(__dirname, '../data/knowledgeBase.json');
    const articles = JSON.parse(fs.readFileSync(kbPath, 'utf-8'));
    console.log(`📚 Found ${articles.length} knowledge base articles to embed.`);

    const vectorsToUpsert = [];
    for (const article of articles) {
      const textToEmbed = `${article.title}: ${article.content} Keywords: ${(article.keywords || []).join(', ')}`;
      console.log(`   Generating embedding for: "${article.title}"...`);
      const embedding = await getEmbedding(textToEmbed);

      vectorsToUpsert.push({
        id: article.id,
        values: embedding,
        metadata: {
          title: article.title,
          category: article.category,
          content: article.content
        }
      });
    }

    console.log(`🚀 Upserting ${vectorsToUpsert.length} vectors to Pinecone...`);
    await index.upsert({
      records: vectorsToUpsert
    });
    console.log(`🎉 Successfully seeded knowledge base into Pinecone index "${PINECONE_INDEX_NAME}"!`);
  } catch (err) {
    console.error('❌ Error during Pinecone seeding:', err);
    process.exit(1);
  }
}

seed();
