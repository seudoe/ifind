import { log } from "console";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var __ifindMongoose: MongooseCache | undefined;
}

const cached = global.__ifindMongoose ?? { conn: null, promise: null };
global.__ifindMongoose = cached;

/** Reuses the connection across Next.js hot reloads and API requests. */
export async function connectDB(): Promise<typeof mongoose> {
  log(MONGODB_URI)
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured. Add it to .env.local.");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 30_000,
      family: 4,
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    throw error;
  }
}
