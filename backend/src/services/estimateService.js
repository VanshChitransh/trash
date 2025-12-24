const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');
const { PutObjectCommand } = require('@aws-sdk/client-s3');
const { r2Client, R2_BUCKET_NAME, isR2Configured } = require('../config/r2');

const execAsync = promisify(exec);

/**
 * Find Gemini pipeline directory by trying multiple possible locations
 * @returns {Promise<string>} Path to Gemini pipeline directory
 */
async function findGeminiPipelineDir() {
  // Option 1: Check environment variable first (highest priority)
  if (process.env.GEMINI_PIPELINE_DIR) {
    const envPath = path.resolve(process.env.GEMINI_PIPELINE_DIR);
    try {
      await fs.access(envPath);
      console.log(`[${new Date().toISOString()}] Using GEMINI_PIPELINE_DIR from env: ${envPath}`);
      return envPath;
    } catch (error) {
      console.warn(`[${new Date().toISOString()}] GEMINI_PIPELINE_DIR set but path not accessible: ${envPath}`);
    }
  }
  
  // Option 2: Try relative to current file location (local development)
  // __dirname is /workspace/Backend/backend/src/services
  // So ../../../../ goes to /workspace/ (if Backend is at workspace root)
  const relativePath = path.join(__dirname, '../../../../Gemini-pipeline');
  try {
    await fs.access(relativePath);
    console.log(`[${new Date().toISOString()}] Found Gemini-pipeline at relative path: ${relativePath}`);
    return path.resolve(relativePath);
  } catch (error) {
    // Continue to next option
  }
  
  // Option 3: Try going up from Backend directory to find project root
  // If Backend is at /workspace/Backend, then project root might be /workspace/
  const backendParent = path.join(__dirname, '../../../..'); // Go from services to workspace
  const projectRootPath = path.join(backendParent, 'Gemini-pipeline');
  try {
    await fs.access(projectRootPath);
    console.log(`[${new Date().toISOString()}] Found Gemini-pipeline at project root: ${projectRootPath}`);
    return path.resolve(projectRootPath);
  } catch (error) {
    // Continue to next option
  }
  
  // Option 4: Try workspace root (Digital Ocean default)
  const workspacePath = '/workspace/Gemini-pipeline';
  try {
    await fs.access(workspacePath);
    console.log(`[${new Date().toISOString()}] Found Gemini-pipeline at workspace path: ${workspacePath}`);
    return workspacePath;
  } catch (error) {
    // Continue to next option
  }
  
  // Option 5: Try workspace with project name (Digital Ocean with project structure)
  const workspaceProjectPath = '/workspace/ConsultaBid/Gemini-pipeline';
  try {
    await fs.access(workspaceProjectPath);
    console.log(`[${new Date().toISOString()}] Found Gemini-pipeline at workspace project path: ${workspaceProjectPath}`);
    return workspaceProjectPath;
  } catch (error) {
    // Continue to next option
  }
  
  // Option 6: Try current working directory
  const cwdPath = path.join(process.cwd(), 'Gemini-pipeline');
  try {
    await fs.access(cwdPath);
    console.log(`[${new Date().toISOString()}] Found Gemini-pipeline at CWD path: ${cwdPath}`);
    return path.resolve(cwdPath);
  } catch (error) {
    // All options failed - provide helpful error message
    const triedPaths = [
      `1. GEMINI_PIPELINE_DIR env var: ${process.env.GEMINI_PIPELINE_DIR || 'not set'}`,
      `2. Relative path: ${relativePath}`,
      `3. Project root path: ${projectRootPath}`,
      `4. Workspace path: ${workspacePath}`,
      `5. Workspace project path: ${workspaceProjectPath}`,
      `6. CWD path: ${cwdPath}`,
    ].join('\n    ');
    
    throw new Error(
      `❌ Gemini pipeline directory not found!\n\n` +
      `Tried paths:\n    ${triedPaths}\n\n` +
      `📋 SOLUTION:\n` +
      `1. Deploy the Gemini-pipeline directory to your server\n` +
      `2. Set GEMINI_PIPELINE_DIR environment variable to the correct path\n` +
      `3. Or ensure the directory exists at one of the paths above\n\n` +
      `Current working directory: ${process.cwd()}\n` +
      `Backend location: ${__dirname}\n` +
      `Workspace structure: Check /workspace/ directory contents`
    );
  }
}

/**
 * Process PDF through Gemini pipeline (extraction + estimation)
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} userId - User ID
 * @param {string} fileId - File ID
 * @returns {Promise<{extraction: Object, estimate: Object}>}
 */
async function processEstimate(pdfPath, userId, fileId) {
  // Initialize tempDir at the start to ensure it's available in catch block
  let tempDir = null;
  try {
    // Create temporary directory for processing
    tempDir = path.join(__dirname, '../../temp', userId, fileId);
    await fs.mkdir(tempDir, { recursive: true });

    // Paths for output files
    const extractionOutput = path.join(tempDir, 'extraction.json');
    const estimateOutput = path.join(tempDir, 'estimate.json');

    // Get Gemini pipeline directory using helper function
    const geminiPipelineDir = await findGeminiPipelineDir();
    
    // Check if Gemini pipeline exists
    const extractionScript = path.join(geminiPipelineDir, 'Extraction', 'inspection_extractor.py');
    const estimateScript = path.join(geminiPipelineDir, 'Estimation', 'estimate_builder.py');
    
    // Verify the directory exists (double-check)
    try {
      await fs.access(geminiPipelineDir);
    } catch (error) {
      throw new Error(`Gemini pipeline directory not accessible at: ${geminiPipelineDir}. ${error.message}`);
    }
    
    // Verify scripts exist
    try {
      await fs.access(extractionScript);
      await fs.access(estimateScript);
    } catch (error) {
      throw new Error(`Gemini pipeline scripts not found. Extraction: ${extractionScript}, Estimate: ${estimateScript}`);
    }

    // Get Python interpreter from venv
    const venvPython = path.join(geminiPipelineDir, '.venv', 'bin', 'python');
    let pythonInterpreter = 'python3';
    try {
      await fs.access(venvPython);
      pythonInterpreter = venvPython;
      console.log(`[${new Date().toISOString()}] Using venv Python: ${pythonInterpreter}`);
    } catch (error) {
      console.log(`[${new Date().toISOString()}] Venv Python not found, using system python3`);
    }

    // Note: GEMINI_API_KEY is not required here as the Python scripts
    // read API keys from .env files in the Gemini-pipeline directory

    // Step 1: Extract PDF using Gemini
    console.log(`[${new Date().toISOString()}] Starting PDF extraction for file: ${fileId}`);
    // Python scripts read API keys from .env files, so we don't need to pass GEMINI_API_KEY
    const extractionEnv = {
      ...process.env,
    };
    const extractionCmd = `cd "${geminiPipelineDir}" && "${pythonInterpreter}" "${extractionScript}" "${pdfPath}" --output "${extractionOutput}"`;
    
    let extractionStdout, extractionStderr;
    try {
      const result = await execAsync(extractionCmd, {
        env: extractionEnv,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000, // 5 minutes timeout
      });
      extractionStdout = result.stdout;
      extractionStderr = result.stderr;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Extraction command failed:`, error.message);
      if (error.stdout) console.log('Extraction stdout:', error.stdout);
      if (error.stderr) console.error('Extraction stderr:', error.stderr);
      throw new Error(`PDF extraction failed: ${error.message}. ${error.stderr || ''}`);
    }
    
    if (extractionStderr && !extractionStderr.includes('INFO') && !extractionStderr.includes('WARNING')) {
      console.warn('Extraction warnings:', extractionStderr);
    }

    // Check if extraction output file exists
    try {
      await fs.access(extractionOutput);
      console.log(`[${new Date().toISOString()}] Extraction completed successfully`);
    } catch (error) {
      throw new Error(`Extraction failed: output file not created at ${extractionOutput}. ${extractionStderr || ''}`);
    }

    // Read extraction result
    let extractionData;
    try {
      const extractionContent = await fs.readFile(extractionOutput, 'utf-8');
      extractionData = JSON.parse(extractionContent);
      console.log(`[${new Date().toISOString()}] Extraction data parsed successfully`);
    } catch (error) {
      throw new Error(`Failed to parse extraction JSON: ${error.message}`);
    }

    // Step 2: Generate estimate from extraction
    console.log(`[${new Date().toISOString()}] Starting estimate generation...`);
    // Python scripts read API keys from .env files, so we don't need to pass GEMINI_API_KEY
    const estimateEnv = {
      ...process.env,
    };
    const estimateCmd = `cd "${geminiPipelineDir}" && "${pythonInterpreter}" "${estimateScript}" "${extractionOutput}" --out "${estimateOutput}"`;
    
    let estimateStdout, estimateStderr;
    try {
      const result = await execAsync(estimateCmd, {
        env: estimateEnv,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 300000, // 5 minutes timeout
      });
      estimateStdout = result.stdout;
      estimateStderr = result.stderr;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Estimation command failed:`, error.message);
      if (error.stdout) console.log('Estimation stdout:', error.stdout);
      if (error.stderr) console.error('Estimation stderr:', error.stderr);
      throw new Error(`Estimate generation failed: ${error.message}. ${error.stderr || ''}`);
    }
    
    if (estimateStderr && !estimateStderr.includes('INFO') && !estimateStderr.includes('WARNING')) {
      console.warn('Estimation warnings:', estimateStderr);
    }

    // Check if estimate output file exists
    try {
      await fs.access(estimateOutput);
      console.log(`[${new Date().toISOString()}] Estimation completed successfully`);
    } catch (error) {
      throw new Error(`Estimation failed: output file not created at ${estimateOutput}. ${estimateStderr || ''}`);
    }

    // Read estimate result
    let estimateData;
    try {
      const estimateContent = await fs.readFile(estimateOutput, 'utf-8');
      estimateData = JSON.parse(estimateContent);
      console.log(`[${new Date().toISOString()}] Estimate data parsed successfully`);
    } catch (error) {
      throw new Error(`Failed to parse estimate JSON: ${error.message}`);
    }

    // Step 3: Upload JSON files to R2
    const extractionKey = `estimates/${userId}/${fileId}/extraction.json`;
    const estimateKey = `estimates/${userId}/${fileId}/estimate.json`;

    const extractionJson = JSON.stringify(extractionData, null, 2);
    const estimateJson = JSON.stringify(estimateData, null, 2);

    // Upload extraction JSON
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: extractionKey,
      Body: extractionJson,
      ContentType: 'application/json',
    }));

    // Upload estimate JSON
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: estimateKey,
      Body: estimateJson,
      ContentType: 'application/json',
    }));

    const NEW_PUBLIC_URL = 'https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev';
    const extractionUrl = `${NEW_PUBLIC_URL}/${extractionKey}`;
    const estimateUrl = `${NEW_PUBLIC_URL}/${estimateKey}`;

    // Cleanup temp directory (only if KEEP_TEMP_FILES is not set)
    // Keep files for debugging if KEEP_TEMP_FILES=true, or delay cleanup for 1 hour
    const keepTempFiles = process.env.KEEP_TEMP_FILES === 'true';
    if (!keepTempFiles) {
      // Delay cleanup by 1 hour to allow for debugging
      setTimeout(async () => {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log(`[${new Date().toISOString()}] Cleaned up temp directory: ${tempDir}`);
        } catch (cleanupError) {
          console.warn(`[${new Date().toISOString()}] Failed to cleanup temp directory:`, cleanupError.message);
        }
      }, 3600000); // 1 hour delay
      
      console.log(`[${new Date().toISOString()}] Temp files will be kept for 1 hour at: ${tempDir}`);
      console.log(`[${new Date().toISOString()}] Extraction JSON: ${extractionOutput}`);
      console.log(`[${new Date().toISOString()}] Estimate JSON: ${estimateOutput}`);
    } else {
      console.log(`[${new Date().toISOString()}] KEEP_TEMP_FILES=true, temp files preserved at: ${tempDir}`);
    }

    return {
      extraction: {
        ...extractionData,
        url: extractionUrl,
        key: extractionKey,
        localPath: extractionOutput, // Include local path for debugging
      },
      estimate: {
        ...estimateData,
        url: estimateUrl,
        key: estimateKey,
        localPath: estimateOutput, // Include local path for debugging
      },
      tempDir: tempDir, // Include temp directory path
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error processing estimate:`, error);
    // On error, keep temp files for debugging
    if (tempDir) {
      console.log(`[${new Date().toISOString()}] Error occurred - temp files preserved at: ${tempDir}`);
      console.log(`[${new Date().toISOString()}] You can inspect the files for debugging`);
    }
    throw error;
  }
}

/**
 * Download PDF from R2 to temporary location
 * @param {string} fileUrl - URL of the PDF file in R2
 * @param {string} userId - User ID
 * @param {string} fileId - File ID
 * @returns {Promise<string>} Path to downloaded PDF
 */
async function downloadPdfFromR2(fileUrl, userId, fileId) {
  try {
    // Extract file key from URL
    let fileKey = null;
    if (fileUrl.includes('/uploads/')) {
      const parts = fileUrl.split('/uploads/');
      if (parts.length > 1) {
        fileKey = `uploads/${parts[1]}`;
      }
    }

    if (!fileKey) {
      throw new Error('Could not extract file key from URL');
    }

    // Create temp directory
    const tempDir = path.join(__dirname, '../../temp', userId, fileId);
    await fs.mkdir(tempDir, { recursive: true });

    // Download PDF from R2
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const response = await r2Client.send(new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: fileKey,
    }));

    // Save to temp file
    const pdfPath = path.join(tempDir, 'input.pdf');
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    await fs.writeFile(pdfPath, buffer);

    return pdfPath;
  } catch (error) {
    console.error('Error downloading PDF from R2:', error);
    throw error;
  }
}

/**
 * Fetch existing estimate data from R2
 * @param {string} userId - User ID
 * @param {string} fileId - File ID (PDF upload ID)
 * @returns {Promise<{extraction: Object, estimate: Object}>}
 */
async function fetchExistingEstimateData(userId, fileId) {
  try {
    const prisma = require('../lib/prisma');
    
    // Get the estimate record from database
    const estimate = await prisma.estimate.findFirst({
      where: {
        sourcePdfId: fileId,
        userId: userId,
      },
    });

    if (!estimate || !estimate.fileUrl) {
      throw new Error('Estimate not found or file URL missing');
    }

    // Extract file key from URL
    // URL format: https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev/estimates/userId/fileId/estimate.json
    let estimateKey = null;
    if (estimate.fileUrl.includes('/estimates/')) {
      const parts = estimate.fileUrl.split('/estimates/');
      if (parts.length > 1) {
        estimateKey = `estimates/${parts[1]}`;
      }
    }

    if (!estimateKey) {
      throw new Error('Could not extract estimate key from URL');
    }

    // Download estimate JSON from R2
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const estimateResponse = await r2Client.send(new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: estimateKey,
    }));

    const estimateChunks = [];
    for await (const chunk of estimateResponse.Body) {
      estimateChunks.push(chunk);
    }
    const estimateBuffer = Buffer.concat(estimateChunks);
    const estimateData = JSON.parse(estimateBuffer.toString('utf-8'));

    // Try to get extraction data from estimate (it might be embedded)
    let extractionData = estimateData.extraction || estimateData.extractionData || null;

    // If extraction is not embedded, try to fetch it from a separate file
    if (!extractionData && estimateData.extractionUrl) {
      try {
        const extractionKey = estimateData.extractionUrl.includes('/extractions/')
          ? estimateData.extractionUrl.split('/extractions/')[1]
          : null;
        
        if (extractionKey) {
          const extractionResponse = await r2Client.send(new GetObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: `extractions/${extractionKey}`,
          }));

          const extractionChunks = [];
          for await (const chunk of extractionResponse.Body) {
            extractionChunks.push(chunk);
          }
          const extractionBuffer = Buffer.concat(extractionChunks);
          extractionData = JSON.parse(extractionBuffer.toString('utf-8'));
        }
      } catch (extractionError) {
        console.warn('Could not fetch separate extraction file, using embedded data if available');
      }
    }

    return {
      extraction: extractionData || {},
      estimate: {
        ...estimateData,
        url: estimate.fileUrl,
        id: estimate.id,
      },
    };
  } catch (error) {
    console.error('Error fetching existing estimate data:', error);
    throw error;
  }
}

/**
 * Generate PDF from estimate data
 * @param {string} userId - User ID
 * @param {string} fileId - File ID (PDF upload ID)
 * @returns {Promise<{pdfUrl: string, pdfKey: string}>}
 */
async function generateEstimatePdf(userId, fileId) {
  let tempDir = null;
  try {
    // Fetch existing estimate data
    const { estimate: estimateData, extraction: extractionData } = await fetchExistingEstimateData(userId, fileId);
    
    if (!estimateData || !estimateData.items) {
      throw new Error('Estimate data not found or invalid. Please generate an estimate first.');
    }

    // Create temporary directory for processing
    tempDir = path.join(__dirname, '../../temp', userId, fileId, 'pdf-generation');
    await fs.mkdir(tempDir, { recursive: true });

    // Save estimate JSON to temp file
    const estimateJsonPath = path.join(tempDir, 'estimate.json');
    await fs.writeFile(estimateJsonPath, JSON.stringify(estimateData, null, 2), 'utf-8');

    // Path for output PDF
    const pdfOutputPath = path.join(tempDir, 'estimate.pdf');

    // Get Gemini pipeline directory using helper function
    const geminiPipelineDir = await findGeminiPipelineDir();
    const pdfScript = path.join(geminiPipelineDir, 'Estimation', 'generate_estimate_pdf.py');

    // Verify script exists
    try {
      await fs.access(pdfScript);
    } catch (error) {
      throw new Error(`PDF generation script not found at: ${pdfScript}`);
    }

    // Get Python interpreter from venv
    const venvPython = path.join(geminiPipelineDir, '.venv', 'bin', 'python');
    let pythonInterpreter = 'python3';
    try {
      await fs.access(venvPython);
      pythonInterpreter = venvPython;
      console.log(`[${new Date().toISOString()}] Using venv Python for PDF generation: ${pythonInterpreter}`);
    } catch (error) {
      console.log(`[${new Date().toISOString()}] Venv Python not found, using system python3 for PDF generation`);
    }

    // Generate PDF using Python script
    console.log(`[${new Date().toISOString()}] Generating estimate PDF for file: ${fileId}`);
    const pdfGenCmd = `cd "${geminiPipelineDir}" && "${pythonInterpreter}" "${pdfScript}" "${estimateJsonPath}" --output "${pdfOutputPath}"`;
    
    let pdfGenStdout, pdfGenStderr;
    try {
      const result = await execAsync(pdfGenCmd, {
        env: process.env,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        timeout: 120000, // 2 minutes timeout
      });
      pdfGenStdout = result.stdout;
      pdfGenStderr = result.stderr;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] PDF generation command failed:`, error.message);
      if (error.stdout) console.log('PDF generation stdout:', error.stdout);
      if (error.stderr) console.error('PDF generation stderr:', error.stderr);
      throw new Error(`PDF generation failed: ${error.message}. ${error.stderr || ''}`);
    }

    // Check if PDF file was created
    try {
      await fs.access(pdfOutputPath);
      console.log(`[${new Date().toISOString()}] PDF generated successfully at: ${pdfOutputPath}`);
    } catch (error) {
      throw new Error(`PDF generation failed: output file not created at ${pdfOutputPath}. ${pdfGenStderr || ''}`);
    }

    // Read PDF file
    const pdfBuffer = await fs.readFile(pdfOutputPath);

    // Upload PDF to R2
    const pdfKey = `estimates/${userId}/${fileId}/estimate.pdf`;
    await r2Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: pdfKey,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    }));

    const NEW_PUBLIC_URL = 'https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev';
    const pdfUrl = `${NEW_PUBLIC_URL}/${pdfKey}`;

    console.log(`[${new Date().toISOString()}] PDF uploaded to R2: ${pdfUrl}`);

    // Cleanup temp directory after a delay
    const keepTempFiles = process.env.KEEP_TEMP_FILES === 'true';
    if (!keepTempFiles) {
      setTimeout(async () => {
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
          console.log(`[${new Date().toISOString()}] Cleaned up PDF generation temp directory: ${tempDir}`);
        } catch (cleanupError) {
          console.warn(`[${new Date().toISOString()}] Failed to cleanup temp directory:`, cleanupError.message);
        }
      }, 3600000); // 1 hour delay
    } else {
      console.log(`[${new Date().toISOString()}] KEEP_TEMP_FILES=true, temp files preserved at: ${tempDir}`);
    }

    return {
      pdfUrl,
      pdfKey,
    };
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error generating estimate PDF:`, error);
    if (tempDir) {
      console.log(`[${new Date().toISOString()}] Error occurred - temp files preserved at: ${tempDir}`);
    }
    throw error;
  }
}

module.exports = {
  processEstimate,
  downloadPdfFromR2,
  fetchExistingEstimateData,
  generateEstimatePdf,
  findGeminiPipelineDir, // Export for diagnostic routes
};

