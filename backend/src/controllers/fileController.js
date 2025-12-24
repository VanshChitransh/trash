const { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');
const pdfParse = require('pdf-parse');
const prisma = require('../lib/prisma');
const { r2Client, R2_BUCKET_NAME, R2_PUBLIC_URL, isR2Configured } = require('../config/r2');

// Helper function to get Prisma user ID
const getPrismaUserId = async (req) => {
  // User should always be from Prisma now
  return req.user.id;
};

// Helper function to extract and update page count for a file
const extractAndUpdatePageCount = async (file) => {
  // If page count already exists, return it
  if (file.pageCount !== null && file.pageCount !== undefined) {
    return file.pageCount;
  }

  try {
    // Extract file key from URL
    let fileKey = null;
    if (file.fileUrl.includes('/uploads/')) {
      const parts = file.fileUrl.split('/uploads/');
      if (parts.length > 1) {
        fileKey = `uploads/${parts[1]}`;
      }
    }

    if (!fileKey) {
      console.warn('Could not extract file key for page count extraction:', file.fileUrl);
      return null;
    }

    // Download PDF from R2
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const response = await r2Client.send(new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
    }));

    // Read PDF buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const pdfBuffer = Buffer.concat(chunks);

    // Extract page count
    const pdfData = await pdfParse(pdfBuffer);
    const pageCount = pdfData.numpages;

    // Update database with page count
    await prisma.pdfUpload.update({
      where: { id: file.id },
      data: { pageCount: pageCount },
    });

    console.log(`Updated page count for file ${file.id}: ${pageCount} pages`);
    return pageCount;
  } catch (error) {
    console.error('Error extracting page count for file:', file.id, error.message);
    return null;
  }
};

// Upload file to R2 and save metadata to database
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided',
      });
    }

    // Check if R2 is configured
    if (!isR2Configured() || !r2Client) {
      return res.status(500).json({
        success: false,
        message: 'File storage is not configured. Please configure Cloudflare R2 credentials.',
        error: 'R2_NOT_CONFIGURED',
      });
    }

    // Ensure we have a Prisma user ID (not MongoDB ObjectId)
    const userId = await getPrismaUserId(req);

    const file = req.file;

    // Check user's total storage usage (100MB limit)
    const STORAGE_LIMIT = 100 * 1024 * 1024; // 100MB in bytes

    // Get all user's files to calculate total storage
    const userFiles = await prisma.pdfUpload.findMany({
      where: { userId },
      select: { fileSize: true },
    });

    const totalStorageUsed = userFiles.reduce((sum, f) => sum + f.fileSize, 0);
    const newTotalStorage = totalStorageUsed + file.size;

    if (newTotalStorage > STORAGE_LIMIT) {
      const storageUsedMB = (totalStorageUsed / (1024 * 1024)).toFixed(2);
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      const limitMB = (STORAGE_LIMIT / (1024 * 1024)).toFixed(0);

      return res.status(400).json({
        success: false,
        message: `Storage limit exceeded. You are using ${storageUsedMB} MB of ${limitMB} MB. This file (${fileSizeMB} MB) would exceed your limit. Please delete some files to free up space.`,
        error: 'STORAGE_LIMIT_EXCEEDED',
        data: {
          storageUsed: totalStorageUsed,
          storageLimit: STORAGE_LIMIT,
          fileSize: file.size,
          storageUsedMB: parseFloat(storageUsedMB),
          storageLimitMB: parseInt(limitMB),
          fileSizeMB: parseFloat(fileSizeMB),
        },
      });
    }

    // Generate unique file key for R2
    const fileExtension = file.originalname.split('.').pop();
    const fileKey = `uploads/${userId}/${randomUUID()}.${fileExtension}`;

    // Upload to R2
    // Set Content-Disposition: inline for PDFs (allows preview), attachment for other files
    const isPdf = file.mimetype === 'application/pdf';
    const contentDisposition = isPdf
      ? `inline; filename="${file.originalname}"`
      : `attachment; filename="${file.originalname}"`;
    
    const uploadParams = {
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: contentDisposition,
    };

    await r2Client.send(new PutObjectCommand(uploadParams));

    // CRITICAL: ALWAYS use the NEW public URL for new uploads
    const NEW_PUBLIC_URL = 'https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev';
    const fileUrl = `${NEW_PUBLIC_URL}/${fileKey}`;

    // Extract PDF page count
    let pageCount = null;
    try {
      const pdfData = await pdfParse(file.buffer);
      pageCount = pdfData.numpages;
    } catch (pdfError) {
      console.warn('Failed to extract PDF page count:', pdfError.message);
      // Continue without page count
    }

    // Save metadata to database
    const pdfUpload = await prisma.pdfUpload.create({
      data: {
        userId,
        fileName: file.originalname,
        fileUrl,
        fileSize: file.size,
        mimeType: file.mimetype,
        isProcessed: false,
        pageCount: pageCount,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    const responseData = {
      id: pdfUpload.id,
      fileName: pdfUpload.fileName,
      fileUrl: pdfUpload.fileUrl,
      fileSize: pdfUpload.fileSize,
      mimeType: pdfUpload.mimeType,
      pageCount: pdfUpload.pageCount,
      uploadedAt: pdfUpload.uploadedAt.toISOString(),
      processedAt: pdfUpload.processedAt?.toISOString() || null,
      isProcessed: pdfUpload.isProcessed,
    };

    // In development, include additional info
    if (process.env.NODE_ENV === 'development') {
      responseData.debug = {
        fileUrl: pdfUpload.fileUrl,
        fileKey: fileKey,
        r2Bucket: R2_BUCKET_NAME,
      };
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] ✅ File uploaded successfully:`, {
        fileName: pdfUpload.fileName,
        fileSize: `${(pdfUpload.fileSize / 1024).toFixed(2)} KB`,
        fileUrl: pdfUpload.fileUrl,
        userId: userId,
      });
    }

    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      data: responseData,
    });
  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] ❌ File upload error:`, error.message);
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${timestamp}] Stack:`, error.stack);
    }
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get storage info for a user
exports.getStorageInfo = async (req, res) => {
  try {
    const userId = await getPrismaUserId(req);
    const STORAGE_LIMIT = 100 * 1024 * 1024; // 100MB in bytes

    // Get all user's files to calculate total storage
    const userFiles = await prisma.pdfUpload.findMany({
      where: { userId },
      select: { fileSize: true },
    });

    const totalStorageUsed = userFiles.reduce((sum, f) => sum + f.fileSize, 0);
    const storageUsedMB = (totalStorageUsed / (1024 * 1024)).toFixed(2);
    const storageLimitMB = (STORAGE_LIMIT / (1024 * 1024)).toFixed(0);
    const storagePercentage = ((totalStorageUsed / STORAGE_LIMIT) * 100).toFixed(1);

    res.status(200).json({
      success: true,
      data: {
        storageUsed: totalStorageUsed,
        storageLimit: STORAGE_LIMIT,
        storageUsedMB: parseFloat(storageUsedMB),
        storageLimitMB: parseInt(storageLimitMB),
        storagePercentage: parseFloat(storagePercentage),
        filesCount: userFiles.length,
      },
    });
  } catch (error) {
    console.error('Get storage info error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch storage info',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get all files for a user
exports.getFiles = async (req, res) => {
  try {
    const userId = await getPrismaUserId(req);
    const userEmail = req.user?.email;
    const { page = 1, limit = 50, status } = req.query;

    // Debug: Log user info to help diagnose database issues
    if (process.env.NODE_ENV === 'development') {
      console.log(`[getFiles] User ID: ${userId}, Email: ${userEmail}`);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where = {
      userId,
      ...(status && { isProcessed: status === 'processed' }),
    };

    const [files, total] = await Promise.all([
      prisma.pdfUpload.findMany({
        where,
        skip,
        take,
        orderBy: {
          uploadedAt: 'desc',
        },
        include: {
          estimate: {
            select: {
              id: true,
              fileName: true,
              status: true,
            },
          },
        },
      }),
      prisma.pdfUpload.count({ where }),
    ]);

    // Map files to frontend format
    // Note: Once uploaded, status is always "completed" (upload is complete)
    // "isProcessed" indicates if the file has been processed for estimate generation
    
    // CRITICAL: ALWAYS use the NEW public URL, regardless of what R2_PUBLIC_URL env var contains
    const NEW_PUBLIC_URL = 'https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev';
    const OLD_PUBLIC_URL_PREFIX = 'db5d21661e68f2d6807259d27131b58e';
    
    // Helper function to normalize URLs - ALWAYS extract path and reconstruct with NEW public URL
    const normalizeFileUrl = (url) => {
      if (!url) return url;
      
      // Extract file path/key from any URL format
      let fileKey = null;
      
      // Try to extract from /uploads/ path (most common format)
      if (url.includes('/uploads/')) {
        const parts = url.split('/uploads/');
        if (parts.length > 1) {
          fileKey = `uploads/${parts[1]}`;
        }
      } else if (url.startsWith('/uploads/')) {
        // Handle relative paths starting with /uploads/
        fileKey = url.substring(1); // Remove leading /
      } else if (url.startsWith('uploads/')) {
        // Handle paths starting with uploads/
        fileKey = url;
      }
      
      // If we found a file key, ALWAYS reconstruct with NEW public URL
      if (fileKey) {
        return `${NEW_PUBLIC_URL}/${fileKey}`;
      }
      
      // If we couldn't extract the path, log warning and return as is
      console.warn('⚠️ Could not extract file path from URL:', url);
      return url;
    };
    
    // Extract page counts for files that don't have them (async, non-blocking in background)
    // Don't wait for these - they'll update in the background
    files
      .filter(file => file.pageCount === null || file.pageCount === undefined)
      .forEach(file => {
        extractAndUpdatePageCount(file).catch(err => {
          console.error('Error updating page count in background:', err);
        });
      });

    const mappedFiles = files.map((file) => {
      // Normalize file URL - ALWAYS use new public URL
      const originalUrl = file.fileUrl;
      let fileUrl = normalizeFileUrl(file.fileUrl);
      
      // Validate: ensure old prefix is NOT present
      if (fileUrl && fileUrl.includes(OLD_PUBLIC_URL_PREFIX)) {
        console.error('❌ ERROR: URL still contains old prefix after normalization!', {
          original: originalUrl,
          normalized: fileUrl
        });
        // Force fix by extracting and reconstructing again
        fileUrl = normalizeFileUrl(originalUrl);
      }
      
      return {
        id: file.id,
        name: file.fileName,
        size: file.fileSize,
        uploadDate: file.uploadedAt.toISOString(),
        status: 'completed', // Upload is always complete once it's in the database
        fileUrl: fileUrl,
        mimeType: file.mimeType,
        pages: file.pageCount || null,
        hasEstimate: !!file.estimate,
        estimateId: file.estimate?.id,
      };
    });

    res.status(200).json({
      success: true,
      data: mappedFiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch files',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get single file
exports.getFile = async (req, res) => {
  try {
    const userId = await getPrismaUserId(req);
    const { id } = req.params;

    let file = await prisma.pdfUpload.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        estimate: true,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Extract page count if missing (non-blocking, but we'll wait for it)
    if (file.pageCount === null || file.pageCount === undefined) {
      const pageCount = await extractAndUpdatePageCount(file);
      if (pageCount !== null) {
        // Re-fetch file to get updated page count
        file = await prisma.pdfUpload.findFirst({
          where: {
            id,
            userId,
          },
          include: {
            estimate: true,
          },
        });
      }
    }

    // CRITICAL: ALWAYS use the NEW public URL, regardless of what R2_PUBLIC_URL env var contains
    const NEW_PUBLIC_URL = 'https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev';
    const OLD_PUBLIC_URL_PREFIX = 'db5d21661e68f2d6807259d27131b58e';
    
    // Helper function to normalize URLs - ALWAYS extract path and reconstruct with NEW public URL
    const normalizeFileUrl = (url) => {
      if (!url) return url;
      
      // Extract file path/key from any URL format
      let fileKey = null;
      
      // Try to extract from /uploads/ path (most common format)
      if (url.includes('/uploads/')) {
        const parts = url.split('/uploads/');
        if (parts.length > 1) {
          fileKey = `uploads/${parts[1]}`;
        }
      } else if (url.startsWith('/uploads/')) {
        // Handle relative paths starting with /uploads/
        fileKey = url.substring(1); // Remove leading /
      } else if (url.startsWith('uploads/')) {
        // Handle paths starting with uploads/
        fileKey = url;
      }
      
      // If we found a file key, ALWAYS reconstruct with NEW public URL
      if (fileKey) {
        return `${NEW_PUBLIC_URL}/${fileKey}`;
      }
      
      // If we couldn't extract the path, log warning and return as is
      console.warn('⚠️ Could not extract file path from URL:', url);
      return url;
    };
    
    const originalUrl = file.fileUrl;
    let fileUrl = normalizeFileUrl(file.fileUrl);
    
    // Validate: ensure old prefix is NOT present
    if (fileUrl && fileUrl.includes(OLD_PUBLIC_URL_PREFIX)) {
      console.error('❌ ERROR: URL still contains old prefix after normalization!', {
        original: originalUrl,
        normalized: fileUrl
      });
      // Force fix by extracting and reconstructing again
      fileUrl = normalizeFileUrl(originalUrl);
    }

    res.status(200).json({
      success: true,
      data: {
        id: file.id,
        name: file.fileName,
        size: file.fileSize,
        uploadDate: file.uploadedAt.toISOString(),
        status: 'completed', // Upload is always complete once it's in the database
        fileUrl: fileUrl,
        mimeType: file.mimeType,
        pages: file.pageCount || null,
        processedAt: file.processedAt?.toISOString(),
        isProcessed: file.isProcessed,
        estimate: file.estimate,
      },
    });
  } catch (error) {
    console.error('Get file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Delete file
exports.deleteFile = async (req, res) => {
  try {
    const userId = await getPrismaUserId(req);
    const { id } = req.params;

    // Find file
    const file = await prisma.pdfUpload.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Extract file key from URL
    // Handle both full URLs and paths
    let fileKey = file.fileUrl;
    if (R2_PUBLIC_URL && file.fileUrl.includes(R2_PUBLIC_URL)) {
      fileKey = file.fileUrl.replace(`${R2_PUBLIC_URL}/`, '');
    } else if (file.fileUrl.startsWith('http')) {
      // Extract path from full URL (e.g., https://pub-xxx.r2.dev/uploads/userId/file.pdf)
      const urlParts = new URL(file.fileUrl);
      fileKey = urlParts.pathname.startsWith('/') ? urlParts.pathname.substring(1) : urlParts.pathname;
    }

    // Delete from R2 if configured
    if (isR2Configured() && r2Client && R2_BUCKET_NAME) {
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: fileKey,
          })
        );
      } catch (r2Error) {
        console.error('R2 delete error:', r2Error);
        // Continue with database deletion even if R2 deletion fails
      }
    }

    // Delete from database (cascade will handle related estimates)
    await prisma.pdfUpload.delete({
      where: {
        id,
      },
    });

    res.status(200).json({
      success: true,
      message: 'File deleted successfully',
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Get preview URL (for viewing in new tab)
exports.getPreviewUrl = async (req, res) => {
  try {
    const userId = await getPrismaUserId(req);
    const { id } = req.params;

    const file = await prisma.pdfUpload.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Return public R2 URL for preview to avoid worker token validation issues
    const NEW_PUBLIC_URL = 'https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev';

    const normalizeFileUrl = (url) => {
      if (!url) return url;
      let fileKey = null;

      if (url.includes('/uploads/')) {
        const parts = url.split('/uploads/');
        if (parts.length > 1) {
          fileKey = `uploads/${parts[1]}`;
        }
      } else if (url.startsWith('/uploads/')) {
        fileKey = url.substring(1);
      } else if (url.startsWith('uploads/')) {
        fileKey = url;
      }

      return fileKey ? `${NEW_PUBLIC_URL}/${fileKey}` : url;
    };

    const previewUrl = normalizeFileUrl(file.fileUrl);

    res.status(200).json({
      success: true,
      data: {
        previewUrl: previewUrl,
        fileName: file.fileName,
      },
    });
  } catch (error) {
    console.error('Get preview URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get preview URL',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Process PDF through Gemini pipeline to generate estimate
exports.processEstimate = async (req, res) => {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting estimate processing for file: ${req.params.id}`);
  
  try {
    const userId = await getPrismaUserId(req);
    const { id } = req.params;
    const { analysisType = 'detailed' } = req.body;

    // Find file
    const file = await prisma.pdfUpload.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    console.log(`[${new Date().toISOString()}] File found: ${file.fileName}`);

    // Check if estimate already exists
    const existingEstimate = await prisma.estimate.findUnique({
      where: { sourcePdfId: id },
    });

    // Check if user needs to wait 2 hours before generating another estimate
    if (existingEstimate && existingEstimate.processingStartedAt) {
      const now = new Date();
      const processingStarted = new Date(existingEstimate.processingStartedAt);
      const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      const timeSinceProcessing = now - processingStarted;
      const remainingTime = twoHoursInMs - timeSinceProcessing;

      if (remainingTime > 0) {
        // User must wait
        const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000));
        const remainingMinutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
        const remainingSeconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

        console.log(`[${new Date().toISOString()}] User must wait ${remainingHours}h ${remainingMinutes}m ${remainingSeconds}s before generating another estimate`);

        return res.status(429).json({
          success: false,
          message: 'Please wait before generating another estimate',
          waitPeriod: {
            remainingMs: remainingTime,
            remainingHours,
            remainingMinutes,
            remainingSeconds,
            processingStartedAt: existingEstimate.processingStartedAt,
            canGenerateAt: new Date(processingStarted.getTime() + twoHoursInMs).toISOString(),
          },
          currentEstimate: {
            id: existingEstimate.id,
            fileName: file.fileName,
            status: existingEstimate.status,
          },
        });
      }
    }

    if (existingEstimate && existingEstimate.fileUrl) {
      console.log(`[${new Date().toISOString()}] Estimate already exists, fetching from R2...`);

      // Import estimate service to fetch existing data
      const { fetchExistingEstimateData } = require('../services/estimateService');

      try {
        const existingData = await fetchExistingEstimateData(userId, id);

        console.log(`[${new Date().toISOString()}] Existing estimate data retrieved successfully`);

        return res.status(200).json({
          success: true,
          message: 'Estimate already exists',
          data: {
            extraction: existingData.extraction,
            estimate: {
              ...existingData.estimate,
              id: existingEstimate.id,
              totalAmount: existingEstimate.totalAmount,
            },
            processingTime: '0s',
            fromCache: true,
          },
        });
      } catch (fetchError) {
        console.warn(`[${new Date().toISOString()}] Failed to fetch existing estimate, will reprocess:`, fetchError.message);
        // Continue with processing if fetch fails
      }
    }

    // Import estimate service
    const { processEstimate, downloadPdfFromR2 } = require('../services/estimateService');

    // Download PDF from R2 to temp location
    console.log(`[${new Date().toISOString()}] Downloading PDF from R2...`);
    const pdfPath = await downloadPdfFromR2(file.fileUrl, userId, id);
    console.log(`[${new Date().toISOString()}] PDF downloaded to: ${pdfPath}`);

    // Process through Gemini pipeline (this can take several minutes)
    console.log(`[${new Date().toISOString()}] Starting Gemini pipeline processing...`);
    
    // Ensure Prisma connection is active before long operation
    if (prisma.ensureConnection) {
      await prisma.ensureConnection();
    } else {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (dbError) {
        console.warn(`[${new Date().toISOString()}] Database connection check failed, reconnecting...`);
        await prisma.$connect();
      }
    }
    
    const result = await processEstimate(pdfPath, userId, id);
    console.log(`[${new Date().toISOString()}] Gemini pipeline completed in ${((Date.now() - startTime) / 1000).toFixed(2)}s`);

    // Reconnect to database if needed before updating (connection may have timed out during long operation)
    if (prisma.ensureConnection) {
      const connected = await prisma.ensureConnection();
      if (!connected) {
        throw new Error('Database connection lost and could not be restored');
      }
    } else {
      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch (dbError) {
        console.warn(`[${new Date().toISOString()}] Database connection lost, reconnecting...`);
        await prisma.$connect();
      }
    }

    // Update file to mark as processed
    await prisma.pdfUpload.update({
      where: { id },
      data: {
        isProcessed: true,
        processedAt: new Date(),
      },
    });

    // Create or update estimate record
    const now = new Date();
    const estimate = await prisma.estimate.upsert({
      where: { sourcePdfId: id },
      update: {
        fileName: `${file.fileName.replace('.pdf', '')}-estimate.json`,
        fileUrl: result.estimate.url,
        fileSize: JSON.stringify(result.estimate).length,
        totalAmount: result.estimate.summary?.total_estimate || 0,
        status: 'final',
        updatedAt: now,
        processingStartedAt: now, // Set processing start time for 2-hour wait period
      },
      create: {
        userId,
        sourcePdfId: id,
        fileName: `${file.fileName.replace('.pdf', '')}-estimate.json`,
        fileUrl: result.estimate.url,
        fileSize: JSON.stringify(result.estimate).length,
        totalAmount: result.estimate.summary?.total_estimate || 0,
        status: 'final',
        processingStartedAt: now, // Set processing start time for 2-hour wait period
      },
    });

    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[${new Date().toISOString()}] Estimate processing completed successfully in ${processingTime}s`);

    res.status(200).json({
      success: true,
      message: 'Estimate processed successfully',
      data: {
        extraction: result.extraction,
        estimate: {
          ...result.estimate,
          id: estimate.id,
          totalAmount: estimate.totalAmount,
        },
        processingTime: `${processingTime}s`,
      },
    });
  } catch (error) {
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[${new Date().toISOString()}] Process estimate error after ${processingTime}s:`, error);
    console.error('Error stack:', error.stack);
    
    // Check if error is a 503 (service overloaded) error
    const errorMessage = error.message || '';
    const isServiceOverloaded = errorMessage.includes('503') || 
                                errorMessage.includes('overloaded') || 
                                errorMessage.includes('UNAVAILABLE') ||
                                errorMessage.includes('try again later');
    
    if (isServiceOverloaded) {
      return res.status(503).json({
        success: false,
        message: 'Service temporarily unavailable',
        error: 'The AI service is currently overloaded. Please try again after some time.',
        errorCode: 'SERVICE_OVERLOADED',
        processingTime: `${processingTime}s`,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to process estimate',
      error: process.env.NODE_ENV === 'development' ? error.message : 'An error occurred while processing the estimate. Please try again.',
      processingTime: `${processingTime}s`,
    });
  }
};

// Get download URL (presigned URL for private files, or direct URL for public)
exports.getDownloadUrl = async (req, res) => {
  try {
    const userId = await getPrismaUserId(req);
    const { id } = req.params;

    const file = await prisma.pdfUpload.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // CRITICAL: ALWAYS use the NEW public URL, regardless of what R2_PUBLIC_URL env var contains
    const NEW_PUBLIC_URL = 'https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev';
    const OLD_PUBLIC_URL_PREFIX = 'db5d21661e68f2d6807259d27131b58e';
    
    // Helper function to normalize URLs - ALWAYS extract path and reconstruct with NEW public URL
    const normalizeFileUrl = (url) => {
      if (!url) return url;
      
      // Extract file path/key from any URL format
      let fileKey = null;
      
      // Try to extract from /uploads/ path (most common format)
      if (url.includes('/uploads/')) {
        const parts = url.split('/uploads/');
        if (parts.length > 1) {
          fileKey = `uploads/${parts[1]}`;
        }
      } else if (url.startsWith('/uploads/')) {
        // Handle relative paths starting with /uploads/
        fileKey = url.substring(1); // Remove leading /
      } else if (url.startsWith('uploads/')) {
        // Handle paths starting with uploads/
        fileKey = url;
      }
      
      // If we found a file key, ALWAYS reconstruct with NEW public URL
      if (fileKey) {
        return `${NEW_PUBLIC_URL}/${fileKey}`;
      }
      
      // If we couldn't extract the path, log warning and return as is
      console.warn('⚠️ Could not extract file path from URL:', url);
      return url;
    };
    
    const originalUrl = file.fileUrl;
    let downloadUrl = normalizeFileUrl(file.fileUrl);
    
    // Validate: ensure old prefix is NOT present
    if (downloadUrl && downloadUrl.includes(OLD_PUBLIC_URL_PREFIX)) {
      console.error('❌ ERROR: URL still contains old prefix after normalization!', {
        original: originalUrl,
        normalized: downloadUrl
      });
      // Force fix by extracting and reconstructing again
      downloadUrl = normalizeFileUrl(originalUrl);
    }
    
    // Return the public URL (R2 public bucket)
    // If you need private files with presigned URLs, uncomment below:
    /*
    const fileKey = file.fileUrl.replace(`${R2_PUBLIC_URL}/`, '');
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
    });
    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
    */

    res.status(200).json({
      success: true,
      data: {
        downloadUrl: downloadUrl,
        fileName: file.fileName,
      },
    });
  } catch (error) {
    console.error('Get download URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get download URL',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Generate PDF from estimate JSON
exports.generateEstimatePdf = async (req, res) => {
  try {
    const userId = await getPrismaUserId(req);
    const { id } = req.params;

    // Find file
    const file = await prisma.pdfUpload.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Check if estimate exists
    const existingEstimate = await prisma.estimate.findUnique({
      where: { sourcePdfId: id },
    });

    if (!existingEstimate) {
      return res.status(404).json({
        success: false,
        message: 'Estimate not found. Please generate an estimate first.',
      });
    }

    // Import estimate service
    const { generateEstimatePdf } = require('../services/estimateService');

    // Generate PDF and upload to R2
    console.log(`[${new Date().toISOString()}] Generating estimate PDF for file: ${id}`);
    const { pdfUrl, pdfKey } = await generateEstimatePdf(userId, id);

    // Update estimate record with PDF URL if needed
    await prisma.estimate.update({
      where: { id: existingEstimate.id },
      data: {
        // Store PDF URL if you want to track it in the database
        // For now, we'll just return it in the response
      },
    });

    res.status(200).json({
      success: true,
      data: {
        pdfUrl,
        pdfKey,
        fileName: `${file.fileName.replace('.pdf', '')}-estimate.pdf`,
      },
    });
  } catch (error) {
    console.error('Generate estimate PDF error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate estimate PDF',
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
};

// Download estimate PDF with CORS support (proxy from R2)
exports.downloadEstimatePdf = async (req, res) => {
  try {
    // For view in browser, user might be passed via query param token instead of auth middleware
    // This happens when opening PDF in new tab, so we need to manually authenticate
    let userId;
    if (req.user) {
      // Already authenticated via middleware
      userId = await getPrismaUserId(req);
    } else {
      // Try to get token from query parameter
      const token = req.query.token;
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // Verify token manually
      const jwt = require('jsonwebtoken');
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Get user from database
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
        });

        if (!user) {
          return res.status(401).json({
            success: false,
            message: 'User not found',
          });
        }

        userId = user.id;
      } catch (jwtError) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token',
        });
      }
    }

    const { id } = req.params;

    // Find file
    const file = await prisma.pdfUpload.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Check if estimate exists
    const existingEstimate = await prisma.estimate.findUnique({
      where: { sourcePdfId: id },
    });

    if (!existingEstimate) {
      return res.status(404).json({
        success: false,
        message: 'Estimate not found. Please generate an estimate first.',
      });
    }

    // Get PDF key from R2
    const pdfKey = `estimates/${userId}/${id}/estimate.pdf`;

    // Download from R2
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const response = await r2Client.send(new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: pdfKey,
    }));

    // Check if file exists
    if (!response.Body) {
      return res.status(404).json({
        success: false,
        message: 'Estimate PDF not found. Please generate it first.',
      });
    }

    // Stream the PDF to the client with proper headers
    const fileName = `${file.fileName.replace('.pdf', '')}-estimate.pdf`;
    
    // Determine if this is a view request (token in query) or download request (Authorization header)
    // View request = inline (open in browser), Download request = attachment (download file)
    const isViewRequest = req.query.token && !req.headers.authorization;
    const contentDisposition = isViewRequest 
      ? `inline; filename="${fileName}"`  // Opens in browser
      : `attachment; filename="${fileName}"`; // Downloads file
    
    // Set CORS headers
    res.set({
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'Content-Length, Content-Disposition',
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition,
      'Cache-Control': 'public, max-age=3600',
    });

    // Convert the ReadableStream to a buffer and send
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    res.send(buffer);
  } catch (error) {
    console.error('Download estimate PDF error:', error);
    
    // Handle 404 errors from R2
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey') {
      return res.status(404).json({
        success: false,
        message: 'Estimate PDF not found. Please generate it first.',
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to download estimate PDF',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// Check estimate wait status
exports.checkEstimateWaitStatus = async (req, res) => {
  try {
    const userId = await getPrismaUserId(req);
    const { id } = req.params;

    // Find file
    const file = await prisma.pdfUpload.findFirst({
      where: {
        id,
        userId,
      },
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
      });
    }

    // Check if estimate exists
    const estimate = await prisma.estimate.findUnique({
      where: { sourcePdfId: id },
    });

    if (!estimate || !estimate.processingStartedAt) {
      // No estimate or no processing started time - user can generate
      return res.status(200).json({
        success: true,
        canGenerate: true,
        message: 'You can generate an estimate for this file',
      });
    }

    // Calculate remaining wait time
    const now = new Date();
    const processingStarted = new Date(estimate.processingStartedAt);
    const twoHoursInMs = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
    const timeSinceProcessing = now - processingStarted;
    const remainingTime = twoHoursInMs - timeSinceProcessing;

    if (remainingTime > 0) {
      // User must wait
      const remainingHours = Math.floor(remainingTime / (60 * 60 * 1000));
      const remainingMinutes = Math.floor((remainingTime % (60 * 60 * 1000)) / (60 * 1000));
      const remainingSeconds = Math.floor((remainingTime % (60 * 1000)) / 1000);

      return res.status(200).json({
        success: true,
        canGenerate: false,
        message: 'Please wait before generating another estimate',
        waitPeriod: {
          remainingMs: remainingTime,
          remainingHours,
          remainingMinutes,
          remainingSeconds,
          processingStartedAt: estimate.processingStartedAt,
          canGenerateAt: new Date(processingStarted.getTime() + twoHoursInMs).toISOString(),
        },
        currentEstimate: {
          id: estimate.id,
          fileName: file.fileName,
          status: estimate.status,
        },
      });
    } else {
      // Wait period is over
      return res.status(200).json({
        success: true,
        canGenerate: true,
        message: 'You can generate a new estimate for this file',
      });
    }
  } catch (error) {
    console.error('Error checking estimate wait status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check estimate wait status',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
