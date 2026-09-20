import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChatSession extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId: string;
  title: string;
  isArchived: boolean;
  messageCount: number;
  lastMessageAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ChatSessionSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    resumeId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      default: 'New Chat',
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for better query performance
ChatSessionSchema.index({ userId: 1, isArchived: 1, lastMessageAt: -1 });
ChatSessionSchema.index({ userId: 1, resumeId: 1 });

const ChatSession: Model<IChatSession> =
  mongoose.models.ChatSession ||
  mongoose.model<IChatSession>('ChatSession', ChatSessionSchema);

export default ChatSession;
