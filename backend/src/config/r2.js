// Cloudflare R2 configuration
const { S3Client } = require('@aws-sdk/client-s3');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_ENDPOINT = process.env.R2_ENDPOINT || (R2_ACCOUNT_ID ? `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com` : null);
// Use the public URL from env, or default to the provided public URL
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL || 'https://pub-1d9da89b7e3443d7b903292df1bb007b.r2.dev';
// Check if R2 is configured
const isR2Configured = () => {
  return !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME);
};

// Create R2 client only if credentials are available
let r2Client = null;
if (isR2Configured()) {
  try {
    r2Client = new S3Client({
      region: 'auto',
      endpoint: R2_ENDPOINT,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });
  } catch (error) {
    console.error('Error initializing R2 client:', error);
  }
} else {
  console.warn('⚠️  R2 is not configured. File uploads will fail. Please set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME environment variables.');
}

module.exports = {
  r2Client,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL,
  isR2Configured,
};

