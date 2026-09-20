import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IChatMessage extends Document {
  sessionId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{
    text: string;
    relevanceScore: number;
    section?: string;
  }>;
  metadata?: {
    model?: string;
    tokens?: number;
    processingTime?: number;
    temperature?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ChatMessageSchema: Schema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: 'ChatSession',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ['user', 'assistant', 'system'],
      required: true,
    },
    content: {
      type: String,
      required: true,
      maxlength: [10000, 'Message content cannot exceed 10000 characters'],
    },
    sources: [
      {
        text: {
          type: String,
          maxlength: 1000,
        },
        relevanceScore: {
          type: Number,
          min: 0,
          max: 1,
        },
        section: String,
      },
    ],
    metadata: {
      model: String,
      tokens: Number,
      processingTime: Number,
      temperature: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries
ChatMessageSchema.index({ sessionId: 1, createdAt: 1 });
ChatMessageSchema.index({ userId: 1, createdAt: -1 });

const ChatMessage: Model<IChatMessage> =
  mongoose.models.ChatMessage ||
  mongoose.model<IChatMessage>('ChatMessage', ChatMessageSchema);

export default ChatMessage;
