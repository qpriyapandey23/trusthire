const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: {
        values: ['student', 'tpo_admin', 'recruiter'],
        message: '{VALUE} is not a valid role',
      },
      default: 'student',
    },
    collegeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'College',
      default: null,
    },
    companyName: {
      type: String,
      trim: true,
      default: null,
    },
    avatar: {
      type: String,
      default: '',
    },
    // OTP fields for password reset — otp stores a bcrypt hash, never plaintext
    otp: {
      type: String,
      default: null,
    },
    otpExpires: {
      type: Date,
      default: null,
    },
    // Brute-force protection: count wrong OTP attempts
    otpAttempts: {
      type: Number,
      default: 0,
    },
    // Resend rate limiting: timestamp of the last OTP send
    otpLastSentAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to hash password if modified
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) return next();
  try {
    // If it's already a bcrypt hash (starts with $2a$ or $2b$), skip re-hashing
    if (this.passwordHash.startsWith('$2a$') || this.passwordHash.startsWith('$2b$')) {
      return next();
    }
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Helper method to compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Don't leak passwordHash or OTP fields in JSON serialization
userSchema.methods.toJSON = function () {
  const userObject = this.toObject();
  delete userObject.passwordHash;
  delete userObject.otp;
  delete userObject.otpExpires;
  delete userObject.otpAttempts;
  delete userObject.otpLastSentAt;
  return userObject;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
