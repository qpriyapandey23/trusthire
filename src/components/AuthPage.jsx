import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, Eye, EyeOff, Mail, Lock, User, Building2, GraduationCap, ChevronRight, ArrowLeft, CheckCircle2, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import './AuthPage.css';

const API_BASE = 'http://localhost:5000/api/auth';

// ─── Utility: simple API caller ───────────────────────────────────────────────
async function apiPost(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ─── Sub-component: OTP Input Boxes ───────────────────────────────────────────
function OtpInput({ value, onChange }) {
  const inputs = useRef([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleChange = (idx, val) => {
    const sanitized = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[idx] = sanitized;
    onChange(next.join(''));
    if (sanitized && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && idx > 0) inputs.current[idx - 1]?.focus();
    if (e.key === 'ArrowRight' && idx < 5) inputs.current[idx + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    onChange(pasted.padEnd(6, '').slice(0, 6));
    const focusIdx = Math.min(pasted.length, 5);
    inputs.current[focusIdx]?.focus();
  };

  return (
    <div className="otp-input-group">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (inputs.current[i] = el)}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={d}
          className={`otp-box ${d ? 'otp-box--filled' : ''}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          aria-label={`OTP digit ${i + 1}`}
        />
      ))}
    </div>
  );
}

// ─── Sub-component: Toast notification ────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [message, onClose]);

  if (!message) return null;
  return (
    <div className={`auth-toast auth-toast--${type}`}>
      {type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      <span>{message}</span>
    </div>
  );
}

// ─── Sub-component: Password Input with toggle ────────────────────────────────
function PasswordInput({ id, value, onChange, placeholder = 'Enter password', autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="auth-input-wrapper">
      <Lock size={16} className="auth-input-icon" />
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="auth-input auth-input--icon auth-input--icon-right"
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="auth-input-toggle"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// ─── Main AuthPage Component ───────────────────────────────────────────────────
export default function AuthPage({ onAuthSuccess }) {
  // View: 'login' | 'signup' | 'forgot-email' | 'forgot-otp' | 'forgot-reset' | 'success'
  const [view, setView] = useState('login');
  const [tab, setTab] = useState('student'); // 'student' | 'admin'
  const [adminRole, setAdminRole] = useState('tpo_admin'); // 'tpo_admin' | 'recruiter'
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'error' });

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirm, setSignupConfirm] = useState('');
  const [signupRole, setSignupRole] = useState('student');

  // Forgot password flow
  const [fpEmail, setFpEmail] = useState('');
  const [fpOtp, setFpOtp] = useState('');
  const [fpResetToken, setFpResetToken] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [otpTimer, setOtpTimer] = useState(0);
  const timerRef = useRef(null);

  const showToast = (message, type = 'error') => setToast({ message, type });
  const clearToast = useCallback(() => setToast({ message: '', type: 'error' }), []);

  // OTP countdown timer
  const startOtpTimer = useCallback((seconds = 60) => {
    setOtpTimer(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const resetView = (v) => {
    clearToast();
    setView(v);
  };

  // ── Login Handler ──────────────────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) return showToast('Please fill in all fields.');
    setLoading(true);
    try {
      const role = tab === 'admin' ? adminRole : 'student';
      const { ok, data } = await apiPost('/login', { email: loginEmail, password: loginPassword, role });
      if (!ok) return showToast(data.message || 'Login failed.');
      if (rememberMe) localStorage.setItem('trusthire_token', data.token);
      showToast('Welcome back! Redirecting…', 'success');
      setTimeout(() => onAuthSuccess?.(data.user, data.token, false), 1200);
    } catch {
      showToast('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── Signup Handler ─────────────────────────────────────────────────────────
  const handleSignup = async (e) => {
    e.preventDefault();
    if (!signupName || !signupEmail || !signupPassword || !signupConfirm)
      return showToast('Please fill in all fields.');
    if (signupPassword !== signupConfirm)
      return showToast('Passwords do not match.');
    if (signupPassword.length < 8)
      return showToast('Password must be at least 8 characters.');
    setLoading(true);
    try {
      const { ok, data } = await apiPost('/register', {
        name: signupName,
        email: signupEmail,
        password: signupPassword,
        role: signupRole,
      });
      if (!ok) return showToast(data.message || 'Registration failed.');
      showToast('Account created! Redirecting…', 'success');
      setTimeout(() => onAuthSuccess?.(data.user, data.token, true), 1200);
    } catch {
      showToast('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: Send OTP ──────────────────────────────────────────────
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!fpEmail) return showToast('Please enter your email address.');
    setLoading(true);
    try {
      const { ok, status, data } = await apiPost('/forgot-password', { email: fpEmail });
      if (!ok) {
        // 429 rate-limit: seed the timer from the server's retryAfterSeconds
        if (status === 429 && data.retryAfterSeconds) {
          startOtpTimer(data.retryAfterSeconds);
        }
        return showToast(data.message || 'Failed to send OTP.');
      }
      showToast('OTP sent! Check your inbox.', 'success');
      startOtpTimer(OTP_RESEND_COOLDOWN_SECONDS);
      resetView('forgot-otp');
    } catch {
      showToast('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Resend cooldown in seconds — mirrors the server default
  const OTP_RESEND_COOLDOWN_SECONDS = 60;

  // ── Forgot Password: Verify OTP ────────────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (fpOtp.length !== 6) return showToast('Please enter the complete 6-digit OTP.');
    setLoading(true);
    try {
      const { ok, data } = await apiPost('/verify-otp', { email: fpEmail, otp: fpOtp });
      if (!ok) {
        // Show attempt-remaining message from the server verbatim
        return showToast(data.message || 'Invalid OTP.');
      }
      setFpResetToken(data.resetToken);
      setFpOtp(''); // clear OTP boxes on success
      showToast('OTP verified!', 'success');
      setTimeout(() => resetView('forgot-reset'), 600);
    } catch {
      showToast('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Forgot Password: Reset ─────────────────────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!fpNewPassword || !fpConfirmPassword) return showToast('Please fill in all fields.');
    if (fpNewPassword !== fpConfirmPassword) return showToast('Passwords do not match.');
    if (fpNewPassword.length < 8) return showToast('Password must be at least 8 characters.');
    setLoading(true);
    try {
      const { ok, data } = await apiPost('/reset-password', {
        resetToken: fpResetToken,
        newPassword: fpNewPassword,
        confirmPassword: fpConfirmPassword,
      });
      if (!ok) return showToast(data.message || 'Reset failed.');
      resetView('success');
    } catch {
      showToast('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (otpTimer > 0) return;
    setLoading(true);
    try {
      const { ok, status, data } = await apiPost('/forgot-password', { email: fpEmail });
      if (!ok) {
        if (status === 429 && data.retryAfterSeconds) {
          startOtpTimer(data.retryAfterSeconds);
        }
        return showToast(data.message || 'Failed to resend OTP.');
      }
      showToast('New OTP sent! Check your inbox.', 'success');
      setFpOtp('');
      startOtpTimer(OTP_RESEND_COOLDOWN_SECONDS);
    } catch {
      showToast('Network error.');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const isLoginView = view === 'login';
  const isSignupView = view === 'signup';
  const isForgotFlow = view.startsWith('forgot') || view === 'success';

  return (
    <div className="auth-page">
      {/* Background decorations */}
      <div className="auth-bg-orb auth-bg-orb--1" />
      <div className="auth-bg-orb auth-bg-orb--2" />
      <div className="auth-bg-grid" />

      {/* Card */}
      <div className="auth-card animate-fade-up">

        {/* ── Brand Header ────────────────────────────────────────── */}
        <div className="auth-brand">
          <div className="auth-brand-icon">
            <ShieldCheck size={20} color="#fff" strokeWidth={2.5} />
          </div>
          <div className="auth-brand-text">
            <span className="auth-brand-name">TrustHire</span>
            <span className="auth-brand-tagline">VERIFIED TALENT INTELLIGENCE</span>
          </div>
        </div>

        {/* ── Main Headline ───────────────────────────────────────── */}
        {!isForgotFlow && (
          <div className="auth-headline">
            <p className="auth-headline-eyebrow">Evidence-Based Placement Intelligence.</p>
            <h1 className="auth-headline-title">
              {isLoginView ? 'Sign in to your account' : 'Create an account'}
            </h1>
            <p className="auth-headline-sub">
              {isLoginView
                ? 'Welcome back. Choose your portal below.'
                : 'Join TrustHire and access verified placement insights.'}
            </p>
          </div>
        )}

        {/* ── Toast ───────────────────────────────────────────────── */}
        {toast.message && (
          <Toast message={toast.message} type={toast.type} onClose={clearToast} />
        )}

        {/* ══════════════════════════════════════════════════════════
            VIEW: LOGIN
        ══════════════════════════════════════════════════════════ */}
        {isLoginView && (
          <form onSubmit={handleLogin} className="auth-form" noValidate>
            {/* Tab Switcher */}
            <div className="auth-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                id="tab-student"
                aria-selected={tab === 'student'}
                className={`auth-tab ${tab === 'student' ? 'auth-tab--active' : ''}`}
                onClick={() => { setTab('student'); clearToast(); }}
              >
                <GraduationCap size={15} />
                Student Login
              </button>
              <button
                type="button"
                role="tab"
                id="tab-admin"
                aria-selected={tab === 'admin'}
                className={`auth-tab ${tab === 'admin' ? 'auth-tab--active' : ''}`}
                onClick={() => { setTab('admin'); clearToast(); }}
              >
                <Building2 size={15} />
                Admin Login
              </button>
            </div>

            {/* Admin Role Selector */}
            {tab === 'admin' && (
              <div className="auth-role-box animate-fade-up">
                <p className="auth-role-label">Select your role</p>
                <label className={`auth-radio ${adminRole === 'tpo_admin' ? 'auth-radio--selected' : ''}`}>
                  <input
                    type="radio"
                    name="adminRole"
                    value="tpo_admin"
                    checked={adminRole === 'tpo_admin'}
                    onChange={() => setAdminRole('tpo_admin')}
                  />
                  <span className="auth-radio-dot" />
                  <span className="auth-radio-content">
                    <span className="auth-radio-title">TPO / College Admin</span>
                    <span className="auth-radio-desc">Placement office & training management</span>
                  </span>
                </label>
                <label className={`auth-radio ${adminRole === 'recruiter' ? 'auth-radio--selected' : ''}`}>
                  <input
                    type="radio"
                    name="adminRole"
                    value="recruiter"
                    checked={adminRole === 'recruiter'}
                    onChange={() => setAdminRole('recruiter')}
                  />
                  <span className="auth-radio-dot" />
                  <span className="auth-radio-content">
                    <span className="auth-radio-title">Recruiter / Company</span>
                    <span className="auth-radio-desc">Browse verified talent pool</span>
                  </span>
                </label>
              </div>
            )}

            {/* Email */}
            <div className="auth-field">
              <label htmlFor="login-email" className="auth-field-label">Email address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="login-email"
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder={tab === 'student' ? 'student@college.edu' : 'admin@company.com'}
                  className="auth-input auth-input--icon"
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <div className="auth-field-header">
                <label htmlFor="login-password" className="auth-field-label">Password</label>
                <button
                  type="button"
                  className="auth-forgot-link"
                  onClick={() => resetView('forgot-email')}
                >
                  Forgot password?
                </button>
              </div>
              <PasswordInput
                id="login-password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
              />
            </div>

            {/* Remember me */}
            <label className="auth-checkbox-label" htmlFor="remember-me">
              <input
                id="remember-me"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="auth-checkbox"
              />
              <span className="auth-checkbox-custom" />
              <span>Remember me</span>
            </label>

            {/* Submit */}
            <button
              id="login-submit-btn"
              type="submit"
              className="auth-btn-primary"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Signing in…' : 'Sign In'}
              {!loading && <ChevronRight size={16} />}
            </button>

            {/* Footer link */}
            <p className="auth-footer-link">
              Don't have an account?{' '}
              <button type="button" onClick={() => resetView('signup')} className="auth-link">
                Request access / Sign Up
              </button>
            </p>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════
            VIEW: SIGNUP
        ══════════════════════════════════════════════════════════ */}
        {isSignupView && (
          <form onSubmit={handleSignup} className="auth-form" noValidate>

            {/* Full Name */}
            <div className="auth-field">
              <label htmlFor="signup-name" className="auth-field-label">Full Name</label>
              <div className="auth-input-wrapper">
                <User size={16} className="auth-input-icon" />
                <input
                  id="signup-name"
                  type="text"
                  value={signupName}
                  onChange={(e) => setSignupName(e.target.value)}
                  placeholder="Your full name"
                  className="auth-input auth-input--icon"
                  autoComplete="name"
                  autoFocus
                />
              </div>
            </div>

            {/* Email */}
            <div className="auth-field">
              <label htmlFor="signup-email" className="auth-field-label">Email address</label>
              <div className="auth-input-wrapper">
                <Mail size={16} className="auth-input-icon" />
                <input
                  id="signup-email"
                  type="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="auth-input auth-input--icon"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Role */}
            <div className="auth-field">
              <label className="auth-field-label">I am a…</label>
              <div className="auth-role-pills">
                {[
                  { value: 'student', label: 'Student', icon: <GraduationCap size={14} /> },
                  { value: 'tpo_admin', label: 'TPO Admin', icon: <Building2 size={14} /> },
                  { value: 'recruiter', label: 'Recruiter', icon: <User size={14} /> },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    id={`role-pill-${r.value}`}
                    className={`auth-role-pill ${signupRole === r.value ? 'auth-role-pill--active' : ''}`}
                    onClick={() => setSignupRole(r.value)}
                  >
                    {r.icon} {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Password */}
            <div className="auth-field">
              <label htmlFor="signup-password" className="auth-field-label">Password</label>
              <PasswordInput
                id="signup-password"
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                placeholder="Min. 8 characters"
                autoComplete="new-password"
              />
            </div>

            {/* Confirm Password */}
            <div className="auth-field">
              <label htmlFor="signup-confirm" className="auth-field-label">Confirm Password</label>
              <PasswordInput
                id="signup-confirm"
                value={signupConfirm}
                onChange={(e) => setSignupConfirm(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            </div>

            <button
              id="signup-submit-btn"
              type="submit"
              className="auth-btn-primary"
              disabled={loading}
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              {loading ? 'Creating account…' : 'Create Account'}
              {!loading && <ChevronRight size={16} />}
            </button>

            <p className="auth-footer-link">
              Already have an account?{' '}
              <button type="button" onClick={() => resetView('login')} className="auth-link">
                Sign in
              </button>
            </p>
          </form>
        )}

        {/* ══════════════════════════════════════════════════════════
            VIEW: FORGOT — STEP 1 (Enter Email)
        ══════════════════════════════════════════════════════════ */}
        {view === 'forgot-email' && (
          <div className="auth-form animate-fade-up">
            <div className="auth-forgot-header">
              <button
                type="button"
                className="auth-back-btn"
                onClick={() => resetView('login')}
                aria-label="Back to login"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 className="auth-forgot-title">Forgot Password</h2>
                <p className="auth-forgot-sub">Enter your email and we'll send a 6-digit OTP</p>
              </div>
            </div>

            <div className="auth-step-indicator">
              <div className="auth-step auth-step--active"><span>1</span><span>Send OTP</span></div>
              <div className="auth-step-line" />
              <div className="auth-step"><span>2</span><span>Verify</span></div>
              <div className="auth-step-line" />
              <div className="auth-step"><span>3</span><span>Reset</span></div>
            </div>

            <form onSubmit={handleSendOtp} noValidate>
              <div className="auth-field">
                <label htmlFor="fp-email" className="auth-field-label">Registered email address</label>
                <div className="auth-input-wrapper">
                  <Mail size={16} className="auth-input-icon" />
                  <input
                    id="fp-email"
                    type="email"
                    value={fpEmail}
                    onChange={(e) => setFpEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="auth-input auth-input--icon"
                    autoFocus
                    autoComplete="email"
                  />
                </div>
              </div>
              <button
                id="send-otp-btn"
                type="submit"
                className="auth-btn-primary"
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                {loading ? 'Sending OTP…' : 'Send OTP'}
              </button>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VIEW: FORGOT — STEP 2 (Verify OTP)
        ══════════════════════════════════════════════════════════ */}
        {view === 'forgot-otp' && (
          <div className="auth-form animate-fade-up">
            <div className="auth-forgot-header">
              <button
                type="button"
                className="auth-back-btn"
                onClick={() => resetView('forgot-email')}
                aria-label="Back"
              >
                <ArrowLeft size={16} />
              </button>
              <div>
                <h2 className="auth-forgot-title">Verify OTP</h2>
                <p className="auth-forgot-sub">
                  Enter the 6-digit code sent to <strong>{fpEmail}</strong>
                </p>
              </div>
            </div>

            <div className="auth-step-indicator">
              <div className="auth-step auth-step--done"><CheckCircle2 size={14} /><span>Sent</span></div>
              <div className="auth-step-line auth-step-line--done" />
              <div className="auth-step auth-step--active"><span>2</span><span>Verify</span></div>
              <div className="auth-step-line" />
              <div className="auth-step"><span>3</span><span>Reset</span></div>
            </div>

            <form onSubmit={handleVerifyOtp} noValidate>
              <div className="auth-field">
                <label className="auth-field-label">One-Time Password</label>
                <OtpInput value={fpOtp} onChange={setFpOtp} />
              </div>

              {/* Resend */}
              <div className="auth-resend-row">
                <button
                  type="button"
                  id="resend-otp-btn"
                  className={`auth-resend-btn ${otpTimer > 0 ? 'auth-resend-btn--disabled' : ''}`}
                  onClick={handleResendOtp}
                  disabled={otpTimer > 0 || loading}
                >
                  <RefreshCw size={13} />
                  {otpTimer > 0 ? `Resend in ${otpTimer}s` : 'Resend OTP'}
                </button>
              </div>

              <button
                id="verify-otp-btn"
                type="submit"
                className="auth-btn-primary"
                disabled={loading || fpOtp.length < 6}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Verifying…' : 'Verify OTP'}
                {!loading && <ChevronRight size={16} />}
              </button>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VIEW: FORGOT — STEP 3 (Reset Password)
        ══════════════════════════════════════════════════════════ */}
        {view === 'forgot-reset' && (
          <div className="auth-form animate-fade-up">
            <div className="auth-forgot-header">
              <div className="auth-brand-icon auth-brand-icon--sm">
                <Lock size={16} color="#fff" />
              </div>
              <div>
                <h2 className="auth-forgot-title">Reset Password</h2>
                <p className="auth-forgot-sub">Choose a strong new password for your account</p>
              </div>
            </div>

            <div className="auth-step-indicator">
              <div className="auth-step auth-step--done"><CheckCircle2 size={14} /><span>Sent</span></div>
              <div className="auth-step-line auth-step-line--done" />
              <div className="auth-step auth-step--done"><CheckCircle2 size={14} /><span>Verified</span></div>
              <div className="auth-step-line auth-step-line--done" />
              <div className="auth-step auth-step--active"><span>3</span><span>Reset</span></div>
            </div>

            <form onSubmit={handleResetPassword} noValidate>
              <div className="auth-field">
                <label htmlFor="fp-new-password" className="auth-field-label">New Password</label>
                <PasswordInput
                  id="fp-new-password"
                  value={fpNewPassword}
                  onChange={(e) => setFpNewPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                />
              </div>
              <div className="auth-field">
                <label htmlFor="fp-confirm-password" className="auth-field-label">Confirm New Password</label>
                <PasswordInput
                  id="fp-confirm-password"
                  value={fpConfirmPassword}
                  onChange={(e) => setFpConfirmPassword(e.target.value)}
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                />
              </div>

              <button
                id="reset-password-btn"
                type="submit"
                className="auth-btn-primary"
                disabled={loading}
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : null}
                {loading ? 'Resetting…' : 'Reset Password'}
                {!loading && <ChevronRight size={16} />}
              </button>
            </form>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            VIEW: SUCCESS
        ══════════════════════════════════════════════════════════ */}
        {view === 'success' && (
          <div className="auth-success animate-fade-up">
            <div className="auth-success-icon">
              <CheckCircle2 size={36} color="#16a34a" />
            </div>
            <h2 className="auth-success-title">Password Reset!</h2>
            <p className="auth-success-sub">
              Your password has been updated successfully. You can now sign in with your new credentials.
            </p>
            <button
              id="go-to-login-btn"
              type="button"
              className="auth-btn-primary"
              onClick={() => {
                setFpEmail(''); setFpOtp(''); setFpNewPassword(''); setFpConfirmPassword('');
                setFpResetToken('');
                resetView('login');
              }}
            >
              Go to Sign In <ChevronRight size={16} />
            </button>
          </div>
        )}

      </div>

      {/* Branding watermark */}
      <div className="auth-watermark">
        © {new Date().getFullYear()} TrustHire &nbsp;·&nbsp; Evidence-Based Placement Intelligence
      </div>
    </div>
  );
}
