import mongoose, { type Document, type Model, Schema } from "mongoose";

/**
 * Analysis Model for iFind
 * Stores comprehensive resume analysis results from IPD Resume Analyzer
 * 
 * Integrated from IPD Resume Analyzer - stores analysis separately from User model
 * References user's embedded resume data in User.resume
 */

export interface IKeywordMatch {
    keyword: string;
    category: 'technical' | 'soft' | 'industry';
    frequency: number;
}

export interface IMissingSkill {
    skill: string;
    category: string;
    importance: 'high' | 'medium' | 'low';
}

export interface IAnalysis extends Document {
    // Reference to the user (primary reference)
    user: mongoose.Types.ObjectId;
    
    // Analysis Status
    analysisStatus: 'pending' | 'processing' | 'completed' | 'failed';
    
    // Enhanced scoring system
    overallScore: number;        // 0-100
    atsScore: number;            // 0-100 - ATS compatibility
    readabilityScore: number;    // 0-100 - clarity and readability
    formatScore: number;         // 0-100 - structure and formatting
    contentScore: number;        // 0-100 - content depth and relevance
    
    // Analysis results
    summary?: string;
    strengths: string[];
    weaknesses: string[];
    
    // Enhanced skill analysis
    missingSkills: IMissingSkill[];
    keywordMatches: IKeywordMatch[];
    
    // Feedback arrays
    grammarFeedback: string[];
    formattingFeedback: string[];
    suggestions: string[];
    recommendations: string[];
    
    // Confidence score for analysis quality
    confidenceScore?: number;  // 0-100
    
    // Error information (if failed)
    errorMessage?: string;
    errorDetails?: string;
    retryCount: number;
    
    // Metadata
    analysisVersion: string;
    aiModel: string;  // e.g., 'gemini-2.5-flash'
    
    // Timestamps
    generatedAt?: Date;
    analysisStartedAt?: Date;
    analysisCompletedAt?: Date;
    
    // Whether this was a forced regeneration
    forcedRegeneration: boolean;
    
    // Auto-managed timestamps
    createdAt: Date;
    updatedAt: Date;
}

const KeywordMatchSchema = new Schema({
    keyword: { type: String, required: true },
    category: { 
        type: String, 
        enum: ['technical', 'soft', 'industry'],
        default: 'technical'
    },
    frequency: { type: Number, default: 1 },
}, { _id: false });

const MissingSkillSchema = new Schema({
    skill: { type: String, required: true },
    category: { type: String, default: 'technical' },
    importance: { 
        type: String, 
        enum: ['high', 'medium', 'low'],
        default: 'medium'
    },
}, { _id: false });

const AnalysisSchema = new Schema<IAnalysis>(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },
        
        analysisStatus: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed'],
            default: 'pending',
            index: true,
        },
        
        // Scoring metrics (0-100 scale)
        overallScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        
        atsScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        
        readabilityScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        
        formatScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        
        contentScore: {
            type: Number,
            min: 0,
            max: 100,
            default: 0,
        },
        
        // Analysis content
        summary: {
            type: String,
            trim: true,
        },
        
        strengths: {
            type: [String],
            default: [],
        },
        
        weaknesses: {
            type: [String],
            default: [],
        },
        
        missingSkills: {
            type: [MissingSkillSchema],
            default: [],
        },
        
        keywordMatches: {
            type: [KeywordMatchSchema],
            default: [],
        },
        
        grammarFeedback: {
            type: [String],
            default: [],
        },
        
        formattingFeedback: {
            type: [String],
            default: [],
        },
        
        suggestions: {
            type: [String],
            default: [],
        },
        
        recommendations: {
            type: [String],
            default: [],
        },
        
        confidenceScore: {
            type: Number,
            min: 0,
            max: 100,
        },
        
        // Error handling
        errorMessage: String,
        errorDetails: String,
        retryCount: {
            type: Number,
            default: 0,
        },
        
        // Metadata
        analysisVersion: {
            type: String,
            default: '1.0',
        },
        
        aiModel: {
            type: String,
            default: 'gemini-2.5-flash',
        },
        
        // Timestamps
        generatedAt: Date,
        analysisStartedAt: Date,
        analysisCompletedAt: Date,
        
        forcedRegeneration: {
            type: Boolean,
            default: false,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient queries
AnalysisSchema.index({ user: 1, createdAt: -1 });
AnalysisSchema.index({ analysisStatus: 1 });

// Virtual for analysis age
AnalysisSchema.virtual('analysisAge').get(function() {
    if (!this.generatedAt) return null;
    return Date.now() - this.generatedAt.getTime();
});

// Instance methods
AnalysisSchema.methods.isStale = function(): boolean {
    if (!this.generatedAt) return true;
    const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;
    const age = this.analysisAge;
    return age ? age > thirtyDaysInMs : true;
};

AnalysisSchema.methods.isInProgress = function(): boolean {
    return this.analysisStatus === 'processing';
};

AnalysisSchema.methods.canRegenerate = function(): boolean {
    return ['completed', 'failed'].includes(this.analysisStatus);
};

// Static methods
AnalysisSchema.statics.findByUserId = function(userId: mongoose.Types.ObjectId) {
    return this.findOne({ user: userId }).sort({ createdAt: -1 });
};

AnalysisSchema.statics.deleteByUserId = function(userId: mongoose.Types.ObjectId) {
    return this.deleteMany({ user: userId });
};

// Delete cached model in Next.js dev environment
if (process.env.NODE_ENV !== 'production' && mongoose.models.Analysis) {
    delete mongoose.models.Analysis;
}

const Analysis: Model<IAnalysis> =
    mongoose.models.Analysis || mongoose.model<IAnalysis>('Analysis', AnalysisSchema);

export default Analysis;
