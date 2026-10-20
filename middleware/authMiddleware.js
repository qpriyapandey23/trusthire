const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes — verifies Bearer JWT from Authorization header or cookie.
 */
async function protect(req, res, next) {
  try {
    let token;

    // 1. Check Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // 2. Fallback to httpOnly cookie
    else if (req.cookies && req.cookies.trusthire_token) {
      token = req.cookies.trusthire_token;
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-passwordHash -otp -otpExpires');
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
}

/**
 * Role-based access guard. Usage: restrict('tpo_admin', 'recruiter')
 */
function restrict(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
    }
    next();
  };
}

module.exports = { protect, restrict };
