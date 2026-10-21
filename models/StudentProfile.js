const mongoose = require('mongoose');

const skillSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    verifiedStatus: {
      type: String,
      enum: ['Verified', 'Unverified', 'Pending'],
      default: 'Pending',
    },
    rationale: {
      type: String,
      default:
        'Pending automated GitHub code audit and semantic verification.',
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  { _id: true }
);

const projectSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    githubUrl: {
      type: String,
      default: '',
      trim: true,
    },
    liveDemoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    techStack: [
      {
        type: String,
        trim: true,
      },
    ],
    githubAudit: {
      checkedAt: Date,
      repoExists: {
        type: Boolean,
        default: false,
      },
      totalCommits: {
        type: Number,
        default: 0,
      },
      authorCommitCount: {
        type: Number,
        default: 0,
      },
      authorshipPercent: {
        type: Number,
        default: 0,
      },
      isFork: {
        type: Boolean,
        default: false,
      },
      languages: [String],
      stars: {
        type: Number,
        default: 0,
      },
      auditSummary: String,
    },
    liveDemoAudit: {
      checkedAt: Date,
      isOnline: {
        type: Boolean,
        default: false,
      },
      httpStatusCode: Number,
      responseTimeMs: Number,
      lastCheckedError: String,
    },
  },
  { _id: true }
);

const certificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    issuer: {
      type: String,
      default: '',
      trim: true,
    },
    proofUrl: {
      type: String,
      default: '',
      trim: true,
    },
    issueDate: Date,
    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

/**
 * Achievement subdocument — extracted from resume by AI parser.
 * Strict anti-hallucination: only populated when explicitly stated in resume text.
 */
const achievementSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { _id: true }
);

const studentProfileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,

      // IMPORTANT:
      // Do not use unique: true.
      // One student can have multiple resume profile documents.
      index: true,
    },

    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      default: null,
      index: true,
    },

    rollNumber: {
      type: String,
      trim: true,
      default: '',
    },

    branch: {
      type: String,
      trim: true,
      default: '',
    },

    graduationYear: {
      type: Number,
      default: new Date().getFullYear(),
    },

    cgpa: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
    },

    githubUsername: {
      type: String,
      trim: true,
      default: '',
    },

    skills: [skillSchema],

    projects: [projectSchema],

    achievements: [achievementSchema],

    certifications: [certificationSchema],

    verificationScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      index: true,
    },

    scoreBreakdown: {
      githubOriginalityScore: {
        type: Number,
        default: 0,
      },
      liveDeploymentScore: {
        type: Number,
        default: 0,
      },
      semanticClaimScore: {
        type: Number,
        default: 0,
      },
      cgpaAcademicScore: {
        type: Number,
        default: 0,
      },
      lastEvaluatedAt: {
        type: Date,
        default: null,
      },
    },

    rawResumeText: {
      type: String,
      default: '',
    },

    resumeFileName: {
      type: String,
      default: '',
    },

    manualOverride: {
      isOverridden: {
        type: Boolean,
        default: false,
      },
      originalScore: Number,
      overrideScore: Number,
      reason: String,
      overriddenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      overriddenAt: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Recruiter discovery
studentProfileSchema.index({
  collegeId: 1,
  verificationScore: -1,
});

// Retrieve a student's profiles, newest first
studentProfileSchema.index({
  userId: 1,
  createdAt: -1,
});

const StudentProfile = mongoose.model(
  'StudentProfile',
  studentProfileSchema
);

module.exports = StudentProfile;