// backend/src/routes/auth.js
const express = require('express');
const router = express.Router();

// Import controllers
const {
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
} = require('../controllers/authController');

// Import middleware
const {
  protect,
  authorize,
  loginRateLimit,
  forgotPasswordRateLimit,
  registerRateLimit,
} = require('../middlewares/auth');

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', registerRateLimit, register);

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', loginRateLimit, login);

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', protect, getMe);

// @route   POST /api/auth/logout
// @desc    Logout user and clear cookie
// @access  Private
router.post('/logout', protect, logout);

// @route   POST /api/auth/forgot-password
// @desc    Send password reset email
// @access  Public
router.post('/forgot-password', forgotPasswordRateLimit, forgotPassword);

// @route   PUT /api/auth/reset-password/:resettoken
// @desc    Reset password
// @access  Public
router.put('/reset-password/:resettoken', resetPassword);

// @route   GET /api/auth/verify-email/:token
// @desc    Verify user email
// @access  Public
router.get('/verify-email/:token', verifyEmail);

// @route   POST /api/auth/google
// @desc    Google OAuth authentication
// @access  Public
router.post('/google', googleAuth);

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, updateProfile);

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', protect, changePassword);

// @route   GET /api/auth/check
// @desc    Check if user is authenticated (for frontend)
// @access  Public
router.get('/check', protect, (req, res) => {
  res.status(200).json({
    success: true,
    authenticated: true,
    user: req.user.getProfileData(),
  });
});

module.exports = router;