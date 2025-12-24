// backend/src/controllers/authController.js
const prisma = require('../lib/prisma');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const {
  validateUserRegistration,
  validateUserLogin,
  validatePasswordReset,
  validateNewPassword,
  validateGoogleAuth,
  sanitizeUserData,
  checkUserExists
} = require('../models/utils/userHelpers');

// Generate JWT Token
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'devsecret';
  if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
    console.warn('JWT_SECRET is not set; using development fallback.');
  }
  const expiresIn = process.env.JWT_EXPIRE || '30d';
  return jwt.sign({ id: userId }, secret, {
    expiresIn,
  });
};

// Send token response
const sendTokenResponse = (user, statusCode, res, message) => {
  const token = generateToken(user.id);
  const cookieDays = Number(process.env.JWT_COOKIE_EXPIRE || 30);
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Cookie options - use 'none' for cross-origin support in production
  // 'none' requires secure: true for security
  const options = {
    expires: new Date(Date.now() + cookieDays * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: isProduction, // Must be true when sameSite is 'none'
    sameSite: isProduction ? 'none' : 'lax', // 'none' for cross-origin, 'lax' for same-site
    path: '/',
  };

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    message,
    token,
    user: sanitizeUserData(user),
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const validation = validateUserRegistration(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { name, email, password } = validation.data;

    const userExists = await checkUserExists(email);
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        emailVerified: false,
        authProvider: 'EMAIL',
        subscriptionStatus: 'FREE',
      },
    });

    // TODO: Generate verification token and send email
    console.log(`User registered: ${email}`);

    sendTokenResponse(user, 201, res, 'User registered successfully');
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const validation = validateUserLogin(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { email, password } = validation.data;

    // Find user with password hash
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    sendTokenResponse(user, 200, res, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      user: sanitizeUserData(user),
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Logout user / clear cookie
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
  });

  res.status(200).json({
    success: true,
    message: 'User logged out successfully',
  });
};

// @desc    Forgot password
// @route   POST /api/auth/forgot-password
// @access  Public
const forgotPassword = async (req, res) => {
  try {
    const validation = validatePasswordReset(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { email } = validation.data;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email',
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetTokenExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Store reset token (you might want to add these fields to your schema)
    // For now, we'll just log it
    const resetUrl = `${req.protocol}://${req.get('host')}/api/auth/reset-password/${resetToken}`;

    // TODO: Send email with reset URL
    console.log(`Password reset URL for ${email}: ${resetUrl}`);

    res.status(200).json({
      success: true,
      message: 'Password reset email sent',
      // In development, send the token for testing
      ...(process.env.NODE_ENV === 'development' && { resetToken }),
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Email could not be sent',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Reset password
// @route   PUT /api/auth/reset-password/:resettoken
// @access  Public
const resetPassword = async (req, res) => {
  try {
    // Note: Password reset tokens need to be stored in the database
    // For now, this is a placeholder - you'll need to add passwordResetToken
    // and passwordResetExpires fields to your User schema
    return res.status(501).json({
      success: false,
      message: 'Password reset not yet implemented. Please contact support.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password reset',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Verify email
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res) => {
  try {
    // Note: Email verification tokens need to be stored in the database
    // For now, this is a placeholder
    return res.status(501).json({
      success: false,
      message: 'Email verification not yet implemented.',
    });
  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during email verification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Google OAuth login/register
// @route   POST /api/auth/google
// @access  Public
const googleAuth = async (req, res) => {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 🔐 Google auth request:`, {
      email: req.body.email,
      name: req.body.name,
      googleId: req.body.googleId,
    });
    
    const validation = validateGoogleAuth(req.body);
    if (!validation.success) {
      console.error('Validation errors:', validation.errors);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.errors,
      });
    }

    const { googleId, email, name, avatar } = validation.data;

    // Check if account exists with this Google ID
    let account = await prisma.account.findFirst({
      where: {
        provider: 'google',
        providerAccountId: googleId,
      },
      include: { user: true },
    });

    let user;

    if (account) {
      user = account.user;
    } else {
      // Check if user exists with this email
      user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });

      if (user) {
        // Link Google account to existing user
        await prisma.account.create({
          data: {
            userId: user.id,
            provider: 'google',
            providerAccountId: googleId,
            providerEmail: email.toLowerCase(),
          },
        });

        // Update user to mark as verified and set auth provider
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            emailVerified: true,
            authProvider: 'GOOGLE',
            image: avatar || user.image,
          },
        });
      } else {
        // Create new user with Google data
        user = await prisma.user.create({
          data: {
            email: email.toLowerCase(),
            name,
            image: avatar || null,
            emailVerified: true,
            authProvider: 'GOOGLE',
            subscriptionStatus: 'FREE',
            accounts: {
              create: {
                provider: 'google',
                providerAccountId: googleId,
                providerEmail: email.toLowerCase(),
              },
            },
          },
        });
      }
    }

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    sendTokenResponse(user, 200, res, 'Google authentication successful');
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during Google authentication',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const fieldsToUpdate = {};
    const allowedFields = ['name'];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        fieldsToUpdate[field] = req.body[field];
      }
    });

    if (Object.keys(fieldsToUpdate).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields provided for update',
      });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: fieldsToUpdate,
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: sanitizeUserData(user),
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during profile update',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Change user password
// @route   PUT /api/auth/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    // Get user with password hash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user has a password (not OAuth user)
    if (!user.passwordHash) {
      return res.status(400).json({
        success: false,
        message: 'Password change is not available for OAuth users',
      });
    }

    // Verify current password
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // Validate new password using password schema
    try {
      const { z } = require('zod');
      const passwordSchema = z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password cannot exceed 128 characters')
        .refine((password) => /[A-Z]/.test(password), {
          message: 'Password must contain at least one uppercase letter',
        })
        .refine((password) => /[a-z]/.test(password), {
          message: 'Password must contain at least one lowercase letter',
        })
        .refine((password) => /\d/.test(password), {
          message: 'Password must contain at least one number',
        })
        .refine((password) => /[!@#$%^&*(),.?":{}|<>]/.test(password), {
          message: 'Password must contain at least one special character',
        });
      
      passwordSchema.parse(newPassword);
    } catch (error) {
      return res.status(400).json({
        success: false,
        message: error.errors?.[0]?.message || 'Password validation failed',
        errors: error.errors,
      });
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        passwordHash: hashedPassword,
      },
    });

    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during password change',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
  forgotPassword,
  resetPassword,
  verifyEmail,
  googleAuth,
  updateProfile,
  changePassword,
};
