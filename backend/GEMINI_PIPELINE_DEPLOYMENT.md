# Gemini Pipeline Deployment Guide

## Problem
When deploying to Digital Ocean (or other production environments), the estimate generation fails with:
```
Error: Gemini pipeline directory not found at: /workspace/Gemini-pipeline
```

This happens because the `Gemini-pipeline` directory is not automatically deployed with the backend.

## Solution Options

### Option 1: Set GEMINI_PIPELINE_DIR Environment Variable (Recommended)

1. **Find where Gemini-pipeline is located in your production environment:**
   - SSH into your Digital Ocean droplet
   - Check if it exists: `ls -la /workspace/`
   - Or check: `ls -la /workspace/ConsultaBid/`

2. **Set the environment variable in Digital Ocean:**
   - Go to your app settings → Environment Variables
   - Add: `GEMINI_PIPELINE_DIR=/workspace/ConsultaBid/Gemini-pipeline` (or wherever it actually is)
   - Restart your app

### Option 2: Deploy Gemini-pipeline Directory

If the directory doesn't exist in production, you need to deploy it:

1. **Copy Gemini-pipeline to your production server:**
   ```bash
   # From your local machine
   scp -r Gemini-pipeline user@your-server:/workspace/ConsultaBid/
   ```

2. **Or include it in your deployment:**
   - If using Git, ensure `Gemini-pipeline` is committed
   - Update your deployment script to copy it to the correct location

3. **Install Python dependencies in production:**
   ```bash
   cd /workspace/ConsultaBid/Gemini-pipeline
   python3 -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Set up API keys:**
   ```bash
   # Create .env files with your Gemini API keys
   echo 'GEMINI_API_KEY="your-key"' > Extraction/.env
   echo 'GEMINI_API_KEY="your-key"' > Estimation/.env
   ```

### Option 3: Use Docker/Container Deployment

If using Docker, ensure the Gemini-pipeline directory is included in your Docker image:

```dockerfile
# In your Dockerfile
COPY Gemini-pipeline /app/Gemini-pipeline
WORKDIR /app/Gemini-pipeline
RUN python3 -m venv .venv && \
    .venv/bin/pip install -r requirements.txt
```

Then set: `GEMINI_PIPELINE_DIR=/app/Gemini-pipeline`

## Verification

After deployment, test the path resolution:

1. **SSH into your production server**
2. **Check if the directory exists:**
   ```bash
   ls -la /workspace/ConsultaBid/Gemini-pipeline
   ls -la /workspace/ConsultaBid/Gemini-pipeline/Extraction/inspection_extractor.py
   ls -la /workspace/ConsultaBid/Gemini-pipeline/Estimation/estimate_builder.py
   ```

3. **Check Python and dependencies:**
   ```bash
   cd /workspace/ConsultaBid/Gemini-pipeline
   python3 --version
   source .venv/bin/activate
   python --version
   pip list | grep google-genai
   ```

4. **Test the path resolution:**
   - The backend will automatically try multiple paths
   - Check the logs when processing an estimate - it will show which path was found

## Path Resolution Order

The backend tries these paths in order:

1. `GEMINI_PIPELINE_DIR` environment variable (if set)
2. `../../../../Gemini-pipeline` (relative to Backend/backend/src/services)
3. `/workspace/Gemini-pipeline` (Digital Ocean default)
4. `/workspace/ConsultaBid/Gemini-pipeline` (with project name)
5. `process.cwd()/Gemini-pipeline` (current working directory)

The first path that exists and is accessible will be used.

## Troubleshooting

### Error: "Gemini pipeline directory not found"
- Check that the directory exists in production
- Verify the path with `ls -la`
- Set `GEMINI_PIPELINE_DIR` environment variable explicitly

### Error: "Python scripts not found"
- Ensure `Extraction/inspection_extractor.py` exists
- Ensure `Estimation/estimate_builder.py` exists
- Check file permissions: `chmod +x *.py`

### Error: "Module not found" (Python errors)
- Install dependencies: `pip install -r requirements.txt`
- Activate virtual environment if using one
- Check Python version: `python3 --version` (should be 3.8+)

### Error: "GEMINI_API_KEY not found"
- Create `.env` files in `Extraction/` and `Estimation/` directories
- Format: `GEMINI_API_KEY="your-actual-key-here"`
- Ensure files are not in `.gitignore` or are deployed separately

## Quick Fix for Digital Ocean

If you're using Digital Ocean App Platform:

1. **Add environment variable:**
   ```
   GEMINI_PIPELINE_DIR=/workspace/ConsultaBid/Gemini-pipeline
   ```

2. **Or if using a different structure, find the actual path:**
   ```bash
   # SSH into your droplet
   find /workspace -name "inspection_extractor.py" -type f
   ```

3. **Set the path to the parent directory of that file:**
   ```
   GEMINI_PIPELINE_DIR=/actual/path/to/Gemini-pipeline
   ```

