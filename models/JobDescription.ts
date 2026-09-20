import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IJobDescription extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  company: string;
  description: string;
  requirements?: string[];
  responsibilities?: string[];
  preferredQualifications?: string[];
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  location?: string;
  employmentType?: 'full-time' | 'part-time' | 'contract' | 'internship' | 'remote';
  industry?: string;
  experienceLevel?: 'entry' | 'mid' | 'senior' | 'lead' | 'executive';
  skills?: string[];
  parsedData?: {
    technicalSkills: string[];
    softSkills: string[];
    tools: string[];
    certifications: string[];
    education: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const JobDescriptionSchema: Schema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Job title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    company: {
      type: String,
      required: [true, 'Company name is required'],
      trim: true,
      maxlength: [200, 'Company name cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Job description is required'],
      maxlength: [10000, 'Description cannot exceed 10000 characters'],
    },
    requirements: [
      {
        type: String,
        trim: true,
      },
    ],
    responsibilities: [
      {
        type: String,
        trim: true,
      },
    ],
    preferredQualifications: [
      {
        type: String,
        trim: true,
      },
    ],
    salary: {
      min: Number,
      max: Number,
      currency: {
        type: String,
        default: 'USD',
      },
    },
    location: {
      type: String,
      trim: true,
    },
    employmentType: {
      type: String,
      enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'],
      default: 'full-time',
    },
    industry: {
      type: String,
      trim: true,
    },
    experienceLevel: {
      type: String,
      enum: ['entry', 'mid', 'senior', 'lead', 'executive'],
      default: 'mid',
    },
    skills: [
      {
        type: String,
        trim: true,
      },
    ],
    parsedData: {
      technicalSkills: [String],
      softSkills: [String],
      tools: [String],
      certifications: [String],
      education: [String],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
JobDescriptionSchema.index({ userId: 1, createdAt: -1 });
JobDescriptionSchema.index({ title: 'text', company: 'text', description: 'text' });

// Virtual for full text search
JobDescriptionSchema.virtual('fullText').get(function () {
  return `${this.title} ${this.company} ${this.description}`;
});

const JobDescription: Model<IJobDescription> =
  mongoose.models.JobDescription ||
  mongoose.model<IJobDescription>('JobDescription', JobDescriptionSchema);

export default JobDescription;
