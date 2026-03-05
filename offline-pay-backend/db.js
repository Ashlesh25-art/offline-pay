import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/offline-pay';
const dbName = process.env.MONGODB_DB_NAME || 'offline_pay';

console.log(`🔗 Connecting to MongoDB...`);
console.log(`📍 URI: ${uri.includes('mongodb+srv') ? 'MongoDB Atlas (Cloud)' : 'Local MongoDB'}`);

const client = new MongoClient(uri);

let db;

export async function connectDB() {
  try {
    await client.connect();
    db = client.db(dbName);
    console.log(`✅ Connected to MongoDB database: ${dbName}`);
    
    // Create indexes
    await db.collection('users').createIndex({ userId: 1 }, { unique: true });
    await db.collection('users').createIndex({ phone: 1 }, { unique: true, sparse: true });
    await db.collection('merchants').createIndex({ merchantId: 1 }, { unique: true });
    await db.collection('vouchers').createIndex({ voucherId: 1 }, { unique: true });
    await db.collection('vouchers').createIndex({ issuedTo: 1 });
    await db.collection('vouchers').createIndex({ merchantId: 1 });
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

export function getDB() {
  if (!db) {
    throw new Error('Database not initialized. Call connectDB() first.');
  }
  return db;
}

export async function closeDB() {
  await client.close();
}
