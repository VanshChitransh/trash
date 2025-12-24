// backend/src/app.js
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Database connection
const { connectDB, checkDBHealth } = require('./config/database');

// Route imports
const authRoutes = require('./routes/auth');
const fileRoutes = require('./routes/files');
const { downloadRouter } = require('./routes/files');
const paymentRoutes = require('./routes/payments');

// Initialize express app
const app = express();

// Trust proxy - required when behind a reverse proxy (Digital Ocean, Vercel, etc.)
// Set to 1 to trust only the first proxy (more secure than 'true')
// This allows express-rate-limit to correctly identify client IPs from X-Forwarded-For headers
app.set('trust proxy', 1);

// Connect to database
connectDB();

// Security middleware
const helmetConfig = {
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Allow popups for OAuth flows (Google sign-in)
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  // Remove Permissions-Policy header to avoid browser warnings about unrecognized features
  permissionsPolicy: false,
};

app.use(helmet(helmetConfig));

// Build allowed origins list (supports comma-separated FRONTEND_URLS or single FRONTEND_URL)
const envList = (process.env.FRONTEND_URLS || '')
  .split(',')
  .map(v => v.trim())
  .filter(Boolean);
const singleEnv = process.env.FRONTEND_URL && process.env.FRONTEND_URL.trim();
const defaultOrigins = ['http://localhost:5173', 'http://localhost:4028'];
const allowedOrigins = Array.from(new Set([...(envList || []), ...(singleEnv ? [singleEnv] : []), ...defaultOrigins]));

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (no origin) and any listed origins
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));

// One-time greeting per origin and explicit preflight handling
const greetedOrigins = new Set();
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin) && !greetedOrigins.has(origin)) {
    console.log(`Hi from backend (first request from ${origin})`);
    greetedOrigins.add(origin);
  }

  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  } else if (!origin && allowedOrigins.length > 0) {
    res.header('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.header('Vary', 'Origin');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser middleware
app.use(cookieParser());

// Global rate limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip trust proxy validation since we've configured it securely above
  validate: {
    trustProxy: false,
  },
});

app.use(globalLimiter);

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method.padEnd(7);
    const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    console.log(`[${timestamp}] ${method} ${url}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const dbHealth = await checkDBHealth();
    
    res.status(200).json({
      success: true,
      message: 'Server is running',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      database: dbHealth,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server health check failed',
      error: error.message,
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
// Mount download router separately (handles authentication manually for query token support)
app.use('/api/files', downloadRouter);
app.use('/api/payments', paymentRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'ConsultaBid API Server',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      files: '/api/files',
    },
  });
});

// 404 handler for undefined routes
app.all('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);

  // Prisma errors
  if (error.code === 'P2002') {
    const message = 'Duplicate field value entered';
    return res.status(400).json({
      success: false,
      message,
    });
  }

  if (error.code === 'P2025') {
    const message = 'Resource not found';
    return res.status(404).json({
      success: false,
      message,
    });
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  // Default error
  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
  });
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);
  
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err);
  console.log('Shutting down the server due to unhandled promise rejection');
  
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  console.log('Shutting down the server due to uncaught exception');
  process.exit(1);
});

// Start server
const PORT = process.env.PORT || 5050;

const server = app.listen(PORT, () => {
  const timestamp = new Date().toISOString();
  console.log(`
  ┌─────────────────────────────────────────┐
  │         ConsultaBid API Server          │
  ├─────────────────────────────────────────┤
  │  Port: ${PORT.toString().padEnd(32)} │
  │  Environment: ${(process.env.NODE_ENV || 'development').padEnd(24)} │
  │  Database: Neon (PostgreSQL)            │
  └─────────────────────────────────────────┘
  `);
  console.log(`[${timestamp}] 🚀 Server started on port ${PORT}`);
});

module.exports = app;
