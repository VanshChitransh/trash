# Temp Files and Database Connection Fixes

## Issues Identified

### 1. **Temp Files Being Deleted Immediately**
**Problem:** 
- Extraction and estimate JSON files were being deleted from the temp folder immediately after processing
- This made debugging difficult when issues occurred
- Files were removed even if there were errors

**Root Cause:**
- The cleanup code was running synchronously right after upload to R2
- No delay or option to preserve files for debugging

### 2. **Database Connection Timeout During Long Operations**
**Problem:**
- Prisma connection errors: `Error { kind: Closed, cause: None }`
- Occurred during long-running operations (6+ minutes for PDF processing)
- Database connections were timing out while Python scripts were running
- This caused failures when trying to update the database after processing

**Root Cause:**
- Neon PostgreSQL connections have idle timeouts
- During the 6+ minute Python processing, no database queries were made
- The connection pool closed idle connections
- When trying to update the database after processing, the connection was already closed

## Fixes Applied

### 1. **Temp File Preservation**
- **Delayed Cleanup:** Temp files are now kept for 1 hour before cleanup (instead of immediate deletion)
- **Error Preservation:** If an error occurs, temp files are preserved indefinitely for debugging
- **Environment Variable:** Added `KEEP_TEMP_FILES=true` option to preserve files permanently
- **Better Logging:** Logs now show the exact paths to temp files for easy access

**Changes:**
- Modified `Backend/backend/src/services/estimateService.js`
- Added 1-hour delay before cleanup
- Added `localPath` and `tempDir` to return values for debugging
- Error handling now preserves files on failure

### 2. **Database Connection Management**
- **Connection Check:** Added `ensureConnection()` helper function to check and reconnect if needed
- **Pre-Processing Check:** Verify connection is active before starting long operations
- **Post-Processing Reconnect:** Automatically reconnect if connection was lost during processing
- **Better Error Handling:** Clear error messages if reconnection fails

**Changes:**
- Modified `Backend/backend/src/lib/prisma.js` - Added `ensureConnection()` helper
- Modified `Backend/backend/src/controllers/fileController.js` - Added connection checks before and after processing

## Usage

### To Keep Temp Files Permanently (for debugging):
Add to your `.env` file:
```env
KEEP_TEMP_FILES=true
```

### Temp File Locations:
After processing, you'll see logs like:
```
Temp files will be kept for 1 hour at: /path/to/temp/userId/fileId
Extraction JSON: /path/to/temp/userId/fileId/extraction.json
Estimate JSON: /path/to/temp/userId/fileId/estimate.json
```

### Database Connection:
The system now automatically:
1. Checks connection before starting long operations
2. Reconnects if connection is lost during processing
3. Provides clear error messages if reconnection fails

## Testing

1. **Test Temp File Preservation:**
   - Process a PDF
   - Check that temp files exist in the logged path
   - Wait 1 hour (or set `KEEP_TEMP_FILES=true`) to verify cleanup behavior

2. **Test Database Reconnection:**
   - Process a PDF (takes 6+ minutes)
   - Monitor logs for connection checks
   - Verify database updates complete successfully after processing

## Notes

- Temp files are stored in: `Backend/backend/temp/{userId}/{fileId}/`
- Files are automatically uploaded to R2 before cleanup
- Database connection pooling is handled by Prisma automatically
- The 1-hour delay gives you time to inspect files if needed

