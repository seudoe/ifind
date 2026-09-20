import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IJobMatch extends Document {
  userId: mongoose.Types.ObjectId;
  resumeId: string;
  jobDescriptionId: mongoose.Types.ObjectId;
  overallScore: number;
  matchDetails: {
    skillsMatch: {
      score: number;
      matchingSkills: Array<{
        skill: string;
        resumeLevel?: string;
        jobRequirement?: string;
      }>;
      missingSkills: string[];
      additionalSkills: string[];
    };
    experienceMatch: {
      score: number;
      yearsRequired?: number;
      yearsInResume?: number;
      analysis: string;
    };
    educationMatch: {
      score: number;
      required?: string;
      actual?: string;
      analysis: string;
    };
    keywordsMatch: {
      score: number;
      matchedKeywords: string[];
      missingKeywords: string[];
      keywordDensity: number;
    };
  };
  recommendations: string[];
  strengthsForRole: string[];
  gapsToAddress: string[];
  status: 'pending' | 'completed' | 'failed';
  processingTime?: number;
  error?: string;
  aiAnalysis?: string;
  createdAt: Date;
  updatedAt: Date;
}

const JobMatchSchema: Schema = new Schema(
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
    jobDescriptionId: {
      type: Schema.Types.ObjectId,
      ref: 'JobDescription',
      required: true,
      index: true,
    },
    overallScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    matchDetails: {
      skillsMatch: {
        score: {
          type: Number,
          min: 0,
          max: 100,
        },
        matchingSkills: [
          {
            skill: String,
            resumeLevel: String,
            jobRequirement: String,
          },
        ],
        missingSkills: [String],
        additionalSkills: [String],
      },
      experienceMatch: {
        score: {
          type: Number,
          min: 0,
          max: 100,
        },
        yearsRequired: Number,
        yearsInResume: Number,
        analysis: String,
      },
      educationMatch: {
        score: {
          type: Number,
          min: 0,
          max: 100,
        },
        required: String,
        actual: String,
        analysis: String,
      },
      keywordsMatch: {
        score: {
          type: Number,
          min: 0,
          max: 100,
        },
        matchedKeywords: [String],
        missingKeywords: [String],
        keywordDensity: Number,
      },
    },
    recommendations: [String],
    strengthsForRole: [String],
    gapsToAddress: [String],
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
    },
    processingTime: Number,
    error: String,
    aiAnalysis: String,
  },
  {
    timestamps: true,
  }
);

// Compound indexes
JobMatchSchema.index({ userId: 1, createdAt: -1 });
JobMatchSchema.index({ resumeId: 1, jobDescriptionId: 1 });
JobMatchSchema.index({ userId: 1, overallScore: -1 });

const JobMatch: Model<IJobMatch> =
  mongoose.models.JobMatch ||
  mongoose.model<IJobMatch>('JobMatch', JobMatchSchema);

export default JobMatch;
