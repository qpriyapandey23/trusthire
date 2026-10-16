const mongoose = require('mongoose');

const collegeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'College name is required'],
      trim: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      unique: true,
    },
    location: {
      type: String,
      default: '',
      trim: true,
    },
    tpoAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Drive eligibility cutoff score slider (hides student profiles scoring below cutoff from recruiters)
    eligibilityCutoffScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 60, // Default cutoff score
    },
    totalStudentsRegistered: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const College = mongoose.model('College', collegeSchema);
module.exports = College;
