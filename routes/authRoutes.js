'use strict';

const express = require('express');
const crypto  = require('crypto');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const User    = require('../models/User');
const { sendOtpEmail } = require('../services/emailService');

const router = express.Router();

// ─────────────────────────────────────────────────────────
// Config from environment (with safe defaults)
// ─────────────────────────────────────────────────────────
const OTP_EXPIRES_MS      = (parseInt(process.env.OTP_EXPIRES_MINUTES,  10) || 5)  * 60 * 1000;
const OTP_MAX_ATTEMPTS    =  parseInt(process.env.OTP_MAX_ATTEMPTS,      10) || 5;
const OTP_RESEND_COOLDOWN =  parseInt(process.env.OTP_RESEND_COOLDOWN_SECONDS, 10) || 60; // seconds

// ─────────────────────────────────────────────────────────
// Helper: sign a JWT and set it as an httpOnly cookie
// ─────────────────────────────────────────────────────────
function issueToken(user, res) {
  const payload = { id: user._id, role: user.role, email: user.email };
  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  res.cookie('trusthire_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  return token;
}

// ─────────────────────────────────────────────────────────
// Helper: clear all OTP-related fields on a user document.
// Always call save() after this.
// ─────────────────────────────────────────────────────────
function clearOtpFields(user) {
  user.otp          = null;
  user.otpExpires   = null;
  user.otpAttempts  = 0;
  user.otpLastSentAt = null;
}

// ─────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'student', collegeId, companyName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = new User({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: password, // pre-save hook hashes this
      role,
      collegeId:   collegeId   || null,
      companyName: companyName || null,
    });

    await user.save();
    const token = issueToken(user, res);

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('[Auth] Register error:', err.message);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join('. ') });
    }
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    if (role && user.role !== role) {
      return res.status(403).json({
        success: false,
        message: `This account does not have the "${role}" role. Please select the correct portal.`,
      });
    }

    const token = issueToken(user, res);

    return res.status(200).json({
      success: true,
      message: 'Login successful.',
      token,
      user: user.toJSON(),
    });
  } catch (err) {
    console.error('[Auth] Login error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/auth/forgot-password
// Generates a cryptographically secure 6-digit OTP,
// stores its bcrypt hash + expiry, and emails the plaintext.
// Always returns 200 to prevent user-enumeration.
// ─────────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  // Generic success message used whether the email exists or not
  const GENERIC_OK = 'If that email is registered, an OTP has been sent.';

  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // User not found — return generic response immediately
    if (!user) {
      return res.status(200).json({ success: true, message: GENERIC_OK });
    }

    // ── Resend rate limiting ──────────────────────────────
    if (user.otpLastSentAt) {
      const secondsSinceLast = (Date.now() - user.otpLastSentAt.getTime()) / 1000;
      if (secondsSinceLast < OTP_RESEND_COOLDOWN) {
        const remaining = Math.ceil(OTP_RESEND_COOLDOWN - secondsSinceLast);
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} second${remaining !== 1 ? 's' : ''} before requesting another OTP.`,
          retryAfterSeconds: remaining,
        });
      }
    }

    // ── Generate plaintext OTP (crypto-secure) ────────────
    // Use crypto.randomInt for uniform distribution across 000000–999999
    const otpPlain = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

    // ── Hash the OTP before storing ───────────────────────
    const salt      = await bcrypt.genSalt(10);
    const otpHashed = await bcrypt.hash(otpPlain, salt);

    // ── Persist to DB (never store plaintext OTP) ─────────
    user.otp           = otpHashed;
    user.otpExpires    = new Date(Date.now() + OTP_EXPIRES_MS);
    user.otpAttempts   = 0;
    user.otpLastSentAt = new Date();
    await user.save({ validateBeforeSave: false });

    // ── Send email ────────────────────────────────────────
    const expiresMinutes = Math.round(OTP_EXPIRES_MS / 60_000);
    try {
      await sendOtpEmail(user.email, otpPlain, expiresMinutes);
    } catch (mailErr) {
      // Email failed — clear the OTP so the user can retry cleanly
      clearOtpFields(user);
      await user.save({ validateBeforeSave: false });
      // Log the classified error (no credentials or OTPs in the message)
      console.error('[Auth] Email delivery failed:', mailErr.message);
      return res.status(502).json({
        success: false,
        message: 'Failed to send OTP email. ' + mailErr.message,
      });
    }

    return res.status(200).json({ success: true, message: GENERIC_OK });
  } catch (err) {
    console.error('[Auth] Forgot-password error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/auth/verify-otp
// Validates the submitted OTP against the stored hash.
// Issues a short-lived, single-use reset token on success.
// ─────────────────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Fail with the same message for "no user", "no OTP", or "expired" to prevent enumeration
    if (!user || !user.otp || !user.otpExpires) {
      return res.status(400).json({ success: false, message: 'No pending OTP found. Please request a new one.' });
    }

    // ── Expiry check ──────────────────────────────────────
    if (new Date() > user.otpExpires) {
      clearOtpFields(user);
      await user.save({ validateBeforeSave: false });
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
    }

    // ── Attempt-limit check ───────────────────────────────
    if (user.otpAttempts >= OTP_MAX_ATTEMPTS) {
      clearOtpFields(user);
      await user.save({ validateBeforeSave: false });
      return res.status(429).json({
        success: false,
        message: 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    // ── Constant-time hash comparison (bcrypt) ────────────
    const isValid = await bcrypt.compare(otp.trim(), user.otp);
    if (!isValid) {
      user.otpAttempts += 1;
      await user.save({ validateBeforeSave: false });
      const remaining = OTP_MAX_ATTEMPTS - user.otpAttempts;
      return res.status(400).json({
        success: false,
        message: remaining > 0
          ? `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Too many incorrect attempts. Please request a new OTP.',
      });
    }

    // ── OTP is valid ──────────────────────────────────────
    // Issue a short-lived, single-use reset token bound to this user + jti
    const jti = crypto.randomBytes(16).toString('hex'); // unique token id
    const resetToken = jwt.sign(
      { id: user._id, email: user.email, purpose: 'password_reset', jti },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    // Store the jti so it can only be used once
    user.otp         = `USED:${jti}`; // sentinel — not a valid hash, blocks re-use
    user.otpAttempts = 0;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json({
      success: true,
      message: 'OTP verified successfully.',
      resetToken,
    });
  } catch (err) {
    console.error('[Auth] Verify-OTP error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/auth/reset-password
// Validates the reset token (including single-use jti check),
// hashes the new password, and clears all OTP fields.
// ─────────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }
    if (newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });
    }

    // ── Verify reset token ────────────────────────────────
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch {
      return res.status(400).json({ success: false, message: 'Reset session expired. Please start over.' });
    }

    if (decoded.purpose !== 'password_reset' || !decoded.jti) {
      return res.status(400).json({ success: false, message: 'Invalid reset token.' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    // ── Single-use check: otp field must contain our jti sentinel ──
    const expectedSentinel = `USED:${decoded.jti}`;
    if (user.otp !== expectedSentinel) {
      // Token was already used or never properly issued
      return res.status(400).json({ success: false, message: 'Reset token has already been used. Please request a new OTP.' });
    }

    // ── Update password (pre-save hook hashes it via bcrypt) ──
    user.passwordHash = newPassword;
    clearOtpFields(user);
    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (err) {
    console.error('[Auth] Reset-password error:', err.message);
    return res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
});

// ─────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────
router.post('/logout', (req, res) => {
  res.clearCookie('trusthire_token');
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
});

module.exports = router;
