const { z } = require('zod');
const prisma = require('../../lib/prisma');
const bcrypt = require('bcrypt');
const { isAdminEmail } = require('../../config/admin');

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

const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .max(255, 'Email cannot exceed 255 characters')
  .transform((email) => email.toLowerCase().trim());

const nameSchema = z
  .string()
  .min(2, 'Name must be at least 2 characters')
  .max(30, 'Name cannot exceed 30 characters')
  .trim()
  .refine((name) => /^[a-zA-Z\s]+$/.test(name), {
    message: 'Name can only contain letters and spaces',
  });

const registerUserSchema = z.object({
  name: nameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['user', 'admin']).default('user').optional(),
});

const loginUserSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

const updateUserSchema = z.object({
  name: nameSchema.optional(),
  email: emailSchema.optional(),
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
  }).optional(),
});

const passwordResetSchema = z.object({
  email: emailSchema,
});

const newPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

const googleAuthSchema = z.object({
  googleId: z.string().min(1, 'Google ID is required'),
  email: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    emailSchema
  ),
  name: z.preprocess(
    (val) => (typeof val === 'string' ? val.trim() : val),
    z.string().min(1, 'Name is required').max(100, 'Name cannot exceed 100 characters')
  ),
  avatar: z.preprocess(
    (val) => {
      if (!val || val === '' || typeof val !== 'string') return undefined;
      const trimmed = val.trim();
      return trimmed === '' ? undefined : trimmed;
    },
    z.string().url().optional()
  ),
});

const validateUserRegistration = (data) => {
  try {
    return {
      success: true,
      data: registerUserSchema.parse(data),
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
};

const validateUserLogin = (data) => {
  try {
    return {
      success: true,
      data: loginUserSchema.parse(data),
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
};

const validateUserUpdate = (data) => {
  try {
    return {
      success: true,
      data: updateUserSchema.parse(data),
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
};

const validatePasswordReset = (data) => {
  try {
    return {
      success: true,
      data: passwordResetSchema.parse(data),
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
};

const validateNewPassword = (data) => {
  try {
    return {
      success: true,
      data: newPasswordSchema.parse(data),
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
};

const validateGoogleAuth = (data) => {
  try {
    return {
      success: true,
      data: googleAuthSchema.parse(data),
      errors: null,
    };
  } catch (error) {
    return {
      success: false,
      data: null,
      errors: error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
      })),
    };
  }
};

const sanitizeUserData = (user) => {
  // Remove sensitive fields and add computed admin role
  const { passwordHash, ...cleanUser } = user;
  const isAdmin = isAdminEmail(user?.email);
  const role = isAdmin ? 'admin' : (user?.role || 'user');

  return {
    ...cleanUser,
    role,
    isAdmin,
    subscriptionStatus: isAdmin ? 'PAID' : cleanUser.subscriptionStatus,
  };
};

const checkUserExists = async (email) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });
  return !!user;
};

module.exports = {
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validatePasswordReset,
  validateNewPassword,
  validateGoogleAuth,
  sanitizeUserData,
  checkUserExists,
};
