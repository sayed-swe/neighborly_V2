import mongoose from 'mongoose';
import path from 'node:path';
import fs from 'node:fs';
import env from './env.js';

let memoryServer;

/**
 * Connects to MongoDB. In development, if MONGODB_URI is not set, starts a local
 * in-memory MongoDB that persists to server/.data so the app runs with zero setup.
 */
export async function connectDB(uri = env.MONGODB_URI) {
  mongoose.set('strictQuery', true);

  if (!uri) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const dbPath = path.resolve(import.meta.dirname, '../../.data/db');
    fs.mkdirSync(dbPath, { recursive: true });
    memoryServer = await MongoMemoryServer.create({
      instance: { dbPath, storageEngine: 'wiredTiger', port: 27027 },
    });
    uri = memoryServer.getUri('neighborly');
    console.log(`🗄️  No MONGODB_URI set: using local dev database (${dbPath})`);
  }

  await mongoose.connect(uri, { autoIndex: true });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
}
