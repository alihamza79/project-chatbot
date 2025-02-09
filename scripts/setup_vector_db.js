import { Pinecone } from '@pinecone-database/pinecone';
import { pipeline } from '@xenova/transformers';
import * as dotenv from 'dotenv';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;

if (!PINECONE_API_KEY || !PINECONE_ENVIRONMENT) {
  throw new Error('Missing required environment variables');
}

class EmbeddingGenerator {
  constructor() {
    this.pipeline = null;
  }

  async init() {
    if (!this.pipeline) {
      // Initialize the embedding pipeline with a lightweight multilingual model
      this.pipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
  }

  async generateEmbedding(text) {
    await this.init();
    const output = await this.pipeline(text, {
      pooling: 'mean',
      normalize: true,
    });
    return Array.from(output.data);
  }
}

async function waitForIndexToBeReady(pinecone, indexName, maxAttempts = 10) {
  console.log('Waiting for index to be ready...');
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${maxAttempts} to check index status...`);
      const indexDescription = await pinecone.describeIndex(indexName);
      if (indexDescription.status?.ready) {
        console.log('Index is ready!');
        return true;
      }
      console.log(`Index not ready yet. Status: ${indexDescription.status?.state}`);
      
      // If initialization failed, throw error immediately
      if (indexDescription.status?.state === 'InitializationFailed') {
        throw new Error('Index initialization failed. Please check your Pinecone console for more details.');
      }
      
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds between attempts
    } catch (error) {
      console.log(`Error checking index status: ${error.message}`);
      if (attempt === maxAttempts || error.message.includes('initialization failed')) throw error;
      await new Promise(resolve => setTimeout(resolve, 30000));
    }
  }
  throw new Error('Index failed to become ready within the timeout period');
}

async function deleteIndexIfExists(pinecone, indexName) {
  try {
    const response = await pinecone.listIndexes();
    const indexExists = response.indexes?.some(index => index.name === indexName);
    if (indexExists) {
      console.log(`Deleting existing index: ${indexName}`);
      await pinecone.deleteIndex(indexName);
      // Wait a bit after deletion
      await new Promise(resolve => setTimeout(resolve, 10000));
    }
  } catch (error) {
    console.error('Error managing indexes:', error);
    throw error;
  }
}

async function setupVectorDB() {
  try {
    console.log('Initializing Pinecone...');
    const pc = new Pinecone({
      apiKey: PINECONE_API_KEY
    });
    
    const indexName = 'hotel-chatbot';
    const dimension = 384; // all-MiniLM-L6-v2 embedding dimension

    // First, delete the index if it exists
    await deleteIndexIfExists(pc, indexName);

    console.log('Creating new index...');
    await pc.createIndex({
      name: indexName,
      dimension: dimension,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });
    
    // Wait for index to be ready with multiple attempts
    await waitForIndexToBeReady(pc, indexName);

    // Get the index
    console.log('Getting index...');
    const index = pc.index(indexName);

    // Initialize embedding generator
    console.log('Initializing embedding generator...');
    const embeddingGenerator = new EmbeddingGenerator();
    await embeddingGenerator.init();

    // Load synthetic conversations
    console.log('Loading conversations...');
    const conversationsPath = join(dirname(__dirname), 'data', 'synthetic_conversations.json');
    const conversationsData = await fs.readFile(conversationsPath, 'utf8');
    const conversations = JSON.parse(conversationsData);

    console.log('Processing conversations for vector database...');

    // Process conversations in smaller batches with delays
    const batchSize = 10; // Very small batch size for starter plan
    for (let i = 0; i < conversations.length; i += batchSize) {
      const batch = conversations.slice(i, i + batchSize);
      
      try {
        // Prepare vectors for the batch
        const vectors = await Promise.all(
          batch.map(async (conv) => {
            // Combine messages into a single string for embedding
            const text = conv.messages.map(m => `${m.role}: ${m.content}`).join('\n');
            const embedding = await embeddingGenerator.generateEmbedding(text);

            return {
              id: conv.id,
              values: embedding,
              metadata: {
                category: conv.category,
                intent: conv.context.intent,
                stage: conv.context.stage,
                text: text
              },
            };
          })
        );

        // Upsert vectors to Pinecone with retry logic
        let retryCount = 0;
        while (retryCount < 3) {
          try {
            await index.upsert(vectors);
            console.log(`Successfully processed batch ${i / batchSize + 1}, total items: ${i + vectors.length}`);
            // Add a longer delay between batches for rate limiting
            await new Promise(resolve => setTimeout(resolve, 2000));
            break;
          } catch (error) {
            retryCount++;
            if (retryCount === 3) throw error;
            console.log(`Retry ${retryCount}/3 for batch ${i / batchSize + 1}`);
            await new Promise(resolve => setTimeout(resolve, 10000));
          }
        }
      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error);
        throw error;
      }
    }

    console.log('Vector database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up vector database:', error);
    if (error.response) {
      console.error('Response data:', error.response.data);
      console.error('Response status:', error.response.status);
    }
    process.exit(1);
  }
}

setupVectorDB(); 