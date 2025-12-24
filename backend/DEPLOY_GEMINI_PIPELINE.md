# Deploy Gemini Pipeline to Digital Ocean

## Quick Fix

The `Gemini-pipeline` directory is **not deployed** to your Digital Ocean server. You need to deploy it.

## Option 1: Deploy via Git (Recommended if using Git)

If your repository is cloned on the server:

1. **SSH into your Digital Ocean droplet:**
   ```bash
   ssh user@your-droplet-ip
   ```

2. **Navigate to workspace and check if repo exists:**
   ```bash
   cd /workspace
   ls -la
   # Check if ConsultaBid or your repo exists
   ```

3. **If repo exists, pull latest changes:**
   ```bash
   cd /workspace/ConsultaBid  # or wherever your repo is
   git pull origin main
   ```

4. **Verify Gemini-pipeline exists:**
   ```bash
   ls -la Gemini-pipeline/
   ls -la Gemini-pipeline/Extraction/inspection_extractor.py
   ```

5. **Install Python dependencies:**
   ```bash
   cd Gemini-pipeline
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

6. **Set up API keys:**
   ```bash
   echo 'GEMINI_API_KEY="AIzaSyBIa_LXdGTKn6twOCrsLwTWFOaOLN3asq4"' > Extraction/.env
   echo 'GEMINI_API_KEY="AIzaSyBIa_LXdGTKn6twOCrsLwTWFOaOLN3asq4"' > Estimation/.env
   ```

7. **Set environment variable in Digital Ocean:**
   - Go to your app settings → Environment Variables
   - Add: `GEMINI_PIPELINE_DIR=/workspace/ConsultaBid/Gemini-pipeline` (adjust path if different)
   - Restart your app

## Option 2: Copy Directory Manually (If not using Git)

1. **From your local machine, copy the directory:**
   ```bash
   # From your local ConsultaBid directory
   scp -r Gemini-pipeline user@your-droplet-ip:/workspace/
   ```

2. **SSH into server and install dependencies:**
   ```bash
   ssh user@your-droplet-ip
   cd /workspace/Gemini-pipeline
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

3. **Set up API keys:**
   ```bash
   echo 'GEMINI_API_KEY="AIzaSyBIa_LXdGTKn6twOCrsLwTWFOaOLN3asq4"' > Extraction/.env
   echo 'GEMINI_API_KEY="AIzaSyBIa_LXdGTKn6twOCrsLwTWFOaOLN3asq4"' > Estimation/.env
   ```

4. **Set environment variable:**
   - Add: `GEMINI_PIPELINE_DIR=/workspace/Gemini-pipeline`
   - Restart app

## Option 3: Use Environment Variable Only (Quickest)

If you know where the directory should be, just set the environment variable:

1. **In Digital Ocean App Settings → Environment Variables:**
   ```
   GEMINI_PIPELINE_DIR=/workspace/ConsultaBid/Gemini-pipeline
   ```
   (Adjust path based on your actual directory structure)

2. **Restart your app**

## Verify Deployment

After deploying, test with the diagnostic endpoint (if in development mode):
```bash
GET /api/files/debug/gemini-pipeline
```

Or check the logs when processing an estimate - it should show which path was found.

## Find Where Directory Should Be

To find where your project is located:

1. **SSH into server:**
   ```bash
   ssh user@your-droplet-ip
   ```

2. **Find the backend location:**
   ```bash
   # Backend is running from /workspace/Backend/backend
   # So project root is likely /workspace/
   cd /workspace
   ls -la
   ```

3. **Check if Gemini-pipeline exists anywhere:**
   ```bash
   find /workspace -name "inspection_extractor.py" -type f 2>/dev/null
   ```

4. **If found, note the directory:**
   ```bash
   # Example output: /workspace/ConsultaBid/Gemini-pipeline/Extraction/inspection_extractor.py
   # Then set: GEMINI_PIPELINE_DIR=/workspace/ConsultaBid/Gemini-pipeline
   ```

## Common Issues

### Issue: "Module not found" errors
**Solution:** Install Python dependencies:
```bash
cd /path/to/Gemini-pipeline
source .venv/bin/activate
pip install -r requirements.txt
```

### Issue: "GEMINI_API_KEY not found"
**Solution:** Create `.env` files:
```bash
echo 'GEMINI_API_KEY="your-key"' > Extraction/.env
echo 'GEMINI_API_KEY="your-key"' > Estimation/.env
```

### Issue: "Permission denied"
**Solution:** Check file permissions:
```bash
chmod +x Extraction/inspection_extractor.py
chmod +x Estimation/estimate_builder.py
```

## Your Current Setup

Based on your logs:
- Backend is at: `/workspace/Backend/backend/`
- Working directory: `/workspace/Backend/backend/`
- Project root should be: `/workspace/` (one level up from Backend)

**Recommended path:** `/workspace/Gemini-pipeline` or `/workspace/ConsultaBid/Gemini-pipeline`

Set: `GEMINI_PIPELINE_DIR=/workspace/Gemini-pipeline` (or wherever you deploy it)

