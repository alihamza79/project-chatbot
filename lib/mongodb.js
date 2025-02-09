import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const options = {
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

if (!uri) {
  throw new Error('Please add your MongoDB URI to .env');
}

let client;
let clientPromise;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise
export { clientPromise };

// Helper function to connect to the database
export async function connectDB() {
  try {
    const client = await clientPromise;
    const db = client.db('hotel-chatbot'); // Specify the database name
    return { db, client };
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
}

// Helper function to safely close the MongoDB connection
export async function closeConnection() {
  try {
    if (client) {
      await client.close();
      console.log('MongoDB connection closed successfully');
    }
  } catch (error) {
    console.error('Error closing MongoDB connection:', error);
    throw error;
  }
} 