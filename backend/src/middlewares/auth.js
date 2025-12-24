// backend/src/middleware/auth.js
const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');
const { isAdminEmail } = require('../config/admin');

// Protect routes - require authentication
const protect = async (req, res, next) => {
  try {
    let token;

    // Get token from header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    // Get token from cookie
    else if (req.cookies.token) {
      token = req.cookies.token;
    }

    // Make sure token exists
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized to access this route - No token provided',
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');

      // Get user from Prisma
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Not authorized - User not found',
        });
      }

      const admin = isAdminEmail(user.email);
      const normalizedUser = {
        ...user,
        role: admin ? 'admin' : (user.role || 'user'),
        isAdmin: admin,
        subscriptionStatus: admin ? 'PAID' : user.subscriptionStatus,
      };

      // Add user to request object
      req.user = normalizedUser;
      req.isPrismaUser = true;
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - Invalid token',
      });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error in authentication',
    });
  }
};

// Grant access to specific roles
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized - User not authenticated',
      });
    }

    // Role is derived from admin allowlist; extend when additional roles are supported
    // if (req.user.role && !roles.includes(req.user.role)) {
    //   return res.status(403).json({
    //     success: false,
    //     message: `User role '${req.user.role}' is not authorized to access this resource`,
    //   });
    // }

    next();
  };
};

// Optional authentication - don't fail if no token
const optionalAuth = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      req.user = null;
      return next();
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'devsecret');
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
      });

      if (user) {
        const admin = isAdminEmail(user.email);
        req.user = {
          ...user,
          role: admin ? 'admin' : (user.role || 'user'),
          isAdmin: admin,
          subscriptionStatus: admin ? 'PAID' : user.subscriptionStatus,
        };
        req.isPrismaUser = true;
      } else {
        req.user = null;
      }

      next();
    } catch (error) {
      req.user = null;
      next();
    }
  } catch (error) {
    console.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

// Check if user is verified
const requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!req.user.emailVerified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required to access this resource',
    });
  }

  next();
};

// Rate limiting for sensitive operations
const createRateLimiter = (windowMs, maxRequests, message) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    // Clean old attempts
    for (const [ip, data] of attempts.entries()) {
      if (now - data.firstAttempt > windowMs) {
        attempts.delete(ip);
      }
    }

    const userAttempts = attempts.get(key);

    if (!userAttempts) {
      attempts.set(key, { count: 1, firstAttempt: now });
      return next();
    }

    if (userAttempts.count >= maxRequests) {
      const timeRemaining = windowMs - (now - userAttempts.firstAttempt);
      return res.status(429).json({
        success: false,
        message: message || 'Too many attempts, please try again later',
        retryAfter: Math.ceil(timeRemaining / 1000),
      });
    }

    userAttempts.count++;
    next();
  };
};

// Specific rate limiters
const loginRateLimit = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  10, // 10 attempts
  'Too many login attempts, please try again in 15 minutes'
);

const forgotPasswordRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  3, // 3 attempts
  'Too many password reset requests, please try again in 1 hour'
);

const registerRateLimit = createRateLimiter(
  60 * 60 * 1000, // 1 hour
  30, // 30 attempts
  'Too many registration attempts, please try again in 1 hour'
);

module.exports = {
  protect,
  authorize,
  optionalAuth,
  requireVerification,
  createRateLimiter,
  loginRateLimit,
  forgotPasswordRateLimit,
  registerRateLimit,
};
