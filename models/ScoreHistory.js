const mongoose = require('mongoose');

const scoreHistorySchema = new mongoose.Schema(
  {
    studentProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    previousScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    newScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    triggerEvent: {
      type: String,
      enum: [
        'INITIAL_RESUME_PARSE',
        'GITHUB_AUDIT_SYNC',
        'DEPLOYMENT_PING_SUCCESS',
        'DEPLOYMENT_PING_FAILURE',
        'BOOSTER_TASK_COMPLETED',
        'MANUAL_TPO_OVERRIDE',
      ],
      default: 'INITIAL_RESUME_PARSE',
    },
    breakdownSnapshot: {
      githubOriginalityScore: Number,
      liveDeploymentScore: Number,
      semanticClaimScore: Number,
      cgpaAcademicScore: Number,
    },
    rationale: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const ScoreHistory = mongoose.model('ScoreHistory', scoreHistorySchema);
module.exports = ScoreHistory;
