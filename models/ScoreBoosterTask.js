const mongoose = require('mongoose');

const scoreBoosterTaskSchema = new mongoose.Schema(
  {
    studentProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['github', 'deployment', 'certification', 'evidence', 'code_originality'],
      default: 'github',
    },
    potentialScoreGain: {
      type: Number,
      required: true,
      min: 1,
      max: 30,
      default: 5,
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Completed', 'Dismissed'],
      default: 'Pending',
      index: true,
    },
    actionUrl: {
      type: String,
      default: '',
    },
    verificationCheckType: {
      type: String,
      enum: ['GITHUB_REPO', 'LIVE_PING', 'CODE_ORIGINALITY', 'CERTIFICATE_PROOF'],
      default: 'GITHUB_REPO',
    },
    targetProjectId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const ScoreBoosterTask = mongoose.model('ScoreBoosterTask', scoreBoosterTaskSchema);
module.exports = ScoreBoosterTask;
