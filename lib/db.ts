import mongoose from "mongoose";
import { log } from "@/lib/logger";

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
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured. Add it to .env.local.");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    log.info("db", "connecting to MongoDB", { database: MONGODB_URI.match(/^mongodb(?:\+srv)?:\/\/[^/?]+\/([^?]*)/)?.[1] || "(default)" });
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 10_000,
      connectTimeoutMS: 10_000,
      socketTimeoutMS: 30_000,
      family: 4,
    });
  }

  try {
    const wasConnected = Boolean(cached.conn);
    cached.conn = await cached.promise;
    if (!wasConnected) log.ok("db", "MongoDB connected", { database: cached.conn.connection.name, host: cached.conn.connection.host });
    return cached.conn;
  } catch (error) {
    log.error("db", "MongoDB connection failed", { error: error instanceof Error ? error.message : String(error) });
    cached.promise = null;
    throw error;
  }
}
