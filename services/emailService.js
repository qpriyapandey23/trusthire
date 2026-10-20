'use strict';

const nodemailer = require('nodemailer');

const dns = require('dns');
const net = require('net');

const SMTP_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.EMAIL_PORT, 10) || 587;
const DNS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache resolved IP address to reduce OS lookup overhead while allowing dynamic refresh
let _cachedSmtp = {
  ip: null,
  expiresAt: 0,
};

/**
 * Resolves the SMTP hostname to an IPv4 address using the operating system's
 * native resolver (dns.lookup / getaddrinfo), bypassing Node.js c-ares DNS timeout issues.
 */
async function resolveSmtpHost(forceRefresh = false) {
  if (net.isIP(SMTP_HOST)) {
    return SMTP_HOST;
  }

  const now = Date.now();
  if (!forceRefresh && _cachedSmtp.ip && _cachedSmtp.expiresAt > now) {
    return _cachedSmtp.ip;
  }

  try {
    const result = await dns.promises.lookup(SMTP_HOST, { family: 4 });
    if (result && result.address) {
      _cachedSmtp = {
        ip: result.address,
        expiresAt: now + DNS_CACHE_TTL_MS,
      };
      return result.address;
    }
  } catch (err) {
    if (_cachedSmtp.ip) {
      return _cachedSmtp.ip;
    }
    console.warn(`[Mailer] System DNS lookup for ${SMTP_HOST} failed: ${err.message}. Using hostname directly.`);
  }

  return SMTP_HOST;
}

function clearTransporterCache() {
  _transporter = null;
  _cachedSmtp = { ip: null, expiresAt: 0 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validate required environment variables at module load time.
// This surfaces misconfiguration immediately instead of at send time.
// ─────────────────────────────────────────────────────────────────────────────
function validateEnv() {
  const missing = [];
  if (!process.env.EMAIL_USER) missing.push('EMAIL_USER');
  if (!process.env.EMAIL_PASS) missing.push('EMAIL_PASS');
  if (missing.length) {
    throw new Error(
      `[Mailer] Missing required environment variable(s): ${missing.join(', ')}. ` +
      `Set them in .env using a Gmail App Password ` +
      `(https://myaccount.google.com/apppasswords).`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Create a Gmail SMTP transporter.
// Uses STARTTLS on port 587 — no certificate verification bypass.
// Called lazily on first use so the env check fires at send time, not import.
// ─────────────────────────────────────────────────────────────────────────────
let _transporter = null;

async function getTransporter(forceRefresh = false) {
  if (_transporter && !forceRefresh) return _transporter;

  validateEnv();

  const user = (process.env.EMAIL_USER || '').trim();
  // Strip whitespace, newlines, and surrounding quotes from Google App Password
  const pass = (process.env.EMAIL_PASS || '').replace(/[\s'"]/g, '');
  const resolvedHost = await resolveSmtpHost(forceRefresh);

  _transporter = nodemailer.createTransport({
    host: resolvedHost,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465, // STARTTLS for 587
    auth: {
      user,
      pass,
    },
    tls: {
      servername: SMTP_HOST, // Preserves SNI and validates TLS certificates against the domain name
    },
    // Do NOT set tls.rejectUnauthorized = false.
    // Let Node.js use its built-in trusted root certificates.
  });

  return _transporter;
}

// ─────────────────────────────────────────────────────────────────────────────
// Send OTP email for password reset.
//
// @param {string} toEmail  - Recipient's registered email address
// @param {string} otp      - Plaintext 6-digit OTP (generated before hashing)
// @param {number} expiresMinutes - How many minutes the OTP is valid for
// ─────────────────────────────────────────────────────────────────────────────
async function sendOtpEmail(toEmail, otp, expiresMinutes = 5) {
  const user = (process.env.EMAIL_USER || '').trim();
  const from = `"TrustHire Security" <${user}>`;

  let transport = await getTransporter();
  let info;
  try {
    info = await transport.sendMail({
      from,
      to: toEmail,
      subject: 'TrustHire – Your Password Reset OTP',
      html: buildOtpHtml(otp, expiresMinutes),
      text: buildOtpText(otp, expiresMinutes),
    });
  } catch (err) {
    const isNetworkErr = ['ECONNECTION', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'].includes(err.code);
    if (isNetworkErr) {
      clearTransporterCache();
      try {
        transport = await getTransporter(true);
        info = await transport.sendMail({
          from,
          to: toEmail,
          subject: 'TrustHire – Your Password Reset OTP',
          html: buildOtpHtml(otp, expiresMinutes),
          text: buildOtpText(otp, expiresMinutes),
        });
      } catch (retryErr) {
        const reason = classifySmtpError(retryErr);
        const wrapped = new Error(`[Mailer] Failed to send OTP email: ${reason}`);
        wrapped.originalCode = retryErr.code;
        throw wrapped;
      }
    } else {
      const reason = classifySmtpError(err);
      const wrapped = new Error(`[Mailer] Failed to send OTP email: ${reason}`);
      wrapped.originalCode = err.code;
      throw wrapped;
    }
  }

  // Log delivery metadata only — no OTPs, no credentials.
  console.log(`[Mailer] OTP email accepted by SMTP for <${toEmail}> (messageId=${info.messageId})`);
  return info;
}

// ─────────────────────────────────────────────────────────────────────────────
// Classify common SMTP errors into human-readable messages for safe logging.
// ─────────────────────────────────────────────────────────────────────────────
function classifySmtpError(err) {
  const code = err.code || '';
  const msg = (err.message || '').toLowerCase();

  if (code === 'EAUTH' || msg.includes('535') || msg.includes('username and password'))
    return 'Gmail authentication failed. Check that EMAIL_USER and EMAIL_PASS (App Password) are correct and that "Less secure app access" or 2-Step Verification is properly configured.';
  if (code === 'ECONNECTION' || code === 'ETIMEDOUT' || code === 'ECONNREFUSED')
    return 'Cannot reach Gmail SMTP server (smtp.gmail.com:587). Check your network or firewall.';
  if (msg.includes('certificate') || msg.includes('ssl') || msg.includes('tls'))
    return 'TLS/SSL handshake failed connecting to Gmail. Verify your system time is correct and that no proxy is intercepting the connection.';
  if (msg.includes('daily sending limit') || msg.includes('quota'))
    return 'Gmail daily sending limit exceeded. Try again later or switch to a transactional email service.';
  return err.message || 'Unknown SMTP error.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Email body builders — OTP value is embedded in the template.
// ─────────────────────────────────────────────────────────────────────────────
function buildOtpHtml(otp, expiresMinutes) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>TrustHire OTP</title>
</head>
<body style="margin:0;padding:0;background:#f0f4ff;font-family:'Inter',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4ff;padding:40px 16px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:14px;overflow:hidden;
                    box-shadow:0 4px 24px rgba(37,99,235,0.10);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:28px 36px;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:rgba(255,255,255,0.18);border-radius:8px;padding:8px;">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                       xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2L3.5 7V12C3.5 16.55 7.2 20.84 12 22C16.8 20.84 20.5 16.55
                             20.5 12V7L12 2Z" stroke="white" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M9 12L11 14L15 10" stroke="white" stroke-width="2"
                          stroke-linecap="round" stroke-linejoin="round"/>
                  </svg>
                </td>
                <td style="padding-left:12px;">
                  <div style="color:#ffffff;font-size:18px;font-weight:800;
                              letter-spacing:-0.025em;">TrustHire</div>
                  <div style="color:rgba(255,255,255,0.75);font-size:9px;
                              text-transform:uppercase;letter-spacing:0.12em;
                              font-weight:700;">VERIFIED TALENT INTELLIGENCE</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 36px 24px;">
            <h1 style="margin:0 0 8px;font-size:22px;font-weight:800;color:#111111;
                        letter-spacing:-0.025em;">Password Reset OTP</h1>
            <p style="margin:0 0 24px;font-size:14px;color:#555555;line-height:1.7;">
              We received a request to reset your TrustHire password.
              Use the one-time code below — it expires in
              <strong>${expiresMinutes} minute${expiresMinutes !== 1 ? 's' : ''}</strong>.
            </p>

            <!-- OTP Box -->
            <div style="background:#eff6ff;border:2px solid #bfdbfe;border-radius:12px;
                        padding:28px;text-align:center;margin-bottom:24px;">
              <div style="font-size:38px;font-weight:900;letter-spacing:0.3em;
                          color:#2563eb;font-family:'Courier New',monospace;
                          line-height:1;">${otp}</div>
              <div style="font-size:12px;color:#6b7280;margin-top:10px;font-weight:500;">
                One-Time Password &nbsp;•&nbsp; Valid for ${expiresMinutes} minutes
              </div>
            </div>

            <p style="margin:0;font-size:13px;color:#9ca3af;line-height:1.6;">
              If you didn't request this, you can safely ignore this email.
              Your password will not be changed.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 36px 26px;border-top:1px solid #e5e7eb;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              &copy; ${year} TrustHire &nbsp;&middot;&nbsp;
              Evidence-Based Placement Intelligence
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buildOtpText(otp, expiresMinutes) {
  return [
    'TrustHire – Password Reset OTP',
    '================================',
    '',
    `Your one-time password is: ${otp}`,
    '',
    `This code expires in ${expiresMinutes} minute${expiresMinutes !== 1 ? 's' : ''}.`,
    '',
    'If you did not request a password reset, please ignore this email.',
    '',
    '© ' + new Date().getFullYear() + ' TrustHire · Evidence-Based Placement Intelligence',
  ].join('\n');
}

async function verifyTransporter() {
  const transport = await getTransporter(true);
  return transport.verify();
}

module.exports = { sendOtpEmail, verifyTransporter };
