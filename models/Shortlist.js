const mongoose = require('mongoose');

const shortlistSchema = new mongoose.Schema(
  {
    jobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
      index: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StudentProfile',
      required: true,
      index: true,
    },
    recruiterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    pipelineStage: {
      type: String,
      enum: ['Shortlisted', 'Technical Review', 'Interview Scheduled', 'Offered', 'Rejected'],
      default: 'Shortlisted',
    },
    recruiterNotes: {
      type: String,
      default: '',
    },
    matchScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Compound unique index ensuring candidate is shortlisted only once per job posting
shortlistSchema.index({ jobId: 1, studentId: 1 }, { unique: true });

const Shortlist = mongoose.model('Shortlist', shortlistSchema);
module.exports = Shortlist;
