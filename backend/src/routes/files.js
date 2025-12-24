const express = require('express');
const multer = require('multer');
const { protect } = require('../middlewares/auth');
const {
  uploadFile,
  getFiles,
  getFile,
  deleteFile,
  getDownloadUrl,
  getPreviewUrl,
  processEstimate,
  generateEstimatePdf,
  downloadEstimatePdf,
  getStorageInfo,
  checkEstimateWaitStatus,
} = require('../controllers/fileController');

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Only accept PDF files
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// All routes require authentication
router.use(protect);

// Diagnostic route to check user info and database connection (development only)
if (process.env.NODE_ENV === 'development') {
  router.get('/debug/user-info', (req, res) => {
    res.status(200).json({
      success: true,
      user: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name,
      },
      database: {
        url: process.env.DATABASE_URL ? 
          process.env.DATABASE_URL.replace(/:[^:]*@/, ':****@') : // Hide password
          'Not set',
      },
    });
  });
  
  // Diagnostic route to check Gemini pipeline directory
  router.get('/debug/gemini-pipeline', async (req, res) => {
    try {
      const { findGeminiPipelineDir } = require('../services/estimateService');
      const pipelineDir = await findGeminiPipelineDir();
      const fs = require('fs').promises;
      
      // Check if key files exist
      const extractionScript = require('path').join(pipelineDir, 'Extraction', 'inspection_extractor.py');
      const estimateScript = require('path').join(pipelineDir, 'Estimation', 'estimate_builder.py');
      
      const files = {
        extractionScript: { exists: false, path: extractionScript },
        estimateScript: { exists: false, path: estimateScript },
      };
      
      try {
        await fs.access(extractionScript);
        files.extractionScript.exists = true;
      } catch (e) {}
      
      try {
        await fs.access(estimateScript);
        files.estimateScript.exists = true;
      } catch (e) {}
      
      res.status(200).json({
        success: true,
        pipelineDir,
        files,
        env: {
          GEMINI_PIPELINE_DIR: process.env.GEMINI_PIPELINE_DIR || 'not set',
        },
        paths: {
          cwd: process.cwd(),
          __dirname: __dirname,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
        env: {
          GEMINI_PIPELINE_DIR: process.env.GEMINI_PIPELINE_DIR || 'not set',
        },
        paths: {
          cwd: process.cwd(),
          __dirname: __dirname,
        },
      });
    }
  });
}

// @route   POST /api/files/upload
// @desc    Upload a PDF file
// @access  Private
router.post('/upload', upload.single('file'), uploadFile);

// @route   GET /api/files
// @desc    Get all files for the authenticated user
// @access  Private
router.get('/', getFiles);

// @route   GET /api/files/storage-info
// @desc    Get storage usage information for the authenticated user
// @access  Private
// NOTE: Must come before /:id route to avoid route conflicts
router.get('/storage-info', getStorageInfo);

// @route   GET /api/files/:id/preview
// @desc    Get preview URL for a file (with worker proxy and authentication)
// @access  Private
// NOTE: Must come before /:id route to avoid route conflicts
router.get('/:id/preview', getPreviewUrl);

// @route   GET /api/files/:id/download
// @desc    Get download URL for a file
// @access  Private
// NOTE: Must come before /:id route to avoid route conflicts
router.get('/:id/download', getDownloadUrl);

// @route   GET /api/files/:id/estimate-wait-status
// @desc    Check if user can generate estimate or must wait
// @access  Private
// NOTE: Must come before /:id route to avoid route conflicts
router.get('/:id/estimate-wait-status', checkEstimateWaitStatus);

// @route   POST /api/files/:id/process-estimate
// @desc    Process PDF through Gemini pipeline to generate estimate
// @access  Private
// NOTE: Must come before /:id route to avoid route conflicts
router.post('/:id/process-estimate', processEstimate);

// @route   POST /api/files/:id/generate-estimate-pdf
// @desc    Generate PDF from estimate JSON and upload to R2
// @access  Private
// NOTE: Must come before /:id route to avoid route conflicts
router.post('/:id/generate-estimate-pdf', generateEstimatePdf);

// @route   GET /api/files/:id
// @desc    Get a single file by ID
// @access  Private
router.get('/:id', getFile);

// @route   DELETE /api/files/:id
// @desc    Delete a file
// @access  Private
router.delete('/:id', deleteFile);

// Create a separate router for the download endpoint (without global protect middleware)
// This allows us to handle authentication manually in the controller (supports query token)
const downloadRouter = express.Router();

// @route   GET /api/files/:id/download-estimate-pdf
// @desc    Download estimate PDF with CORS support (proxied from R2)
// @access  Private (manual auth in controller - supports query token for view in browser)
// NOTE: This is mounted separately to bypass the global protect middleware
downloadRouter.get('/:id/download-estimate-pdf', downloadEstimatePdf);

module.exports = router;
module.exports.downloadRouter = downloadRouter;

