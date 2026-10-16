const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema(
  {
    studentProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Project title is required'],
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
      repoExists: { type: Boolean, default: false },
      totalCommits: { type: Number, default: 0 },
      authorCommitCount: { type: Number, default: 0 },
      authorshipPercent: { type: Number, default: 0 },
      isFork: { type: Boolean, default: false },
      languages: [String],
      stars: { type: Number, default: 0 },
      auditSummary: String,
    },
    liveDemoAudit: {
      checkedAt: Date,
      isOnline: { type: Boolean, default: false },
      httpStatusCode: Number,
      responseTimeMs: Number,
      lastCheckedError: String,
    },
    claimedSkillsVerified: [
      {
        skillName: String,
        isEvidentInCode: Boolean,
        evidenceSnippet: String,
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Project = mongoose.model('Project', projectSchema);
module.exports = Project;
