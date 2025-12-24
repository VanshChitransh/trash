# Dockerfile for ConsultaBid Backend
# This should be built from the repository root with build context: docker build -f Backend/backend/Dockerfile ..

FROM node:18-bullseye-slim

# Install Python 3 and system dependencies for Gemini-pipeline
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    build-essential \
    python3-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /workspace

# Copy package files for dependency installation
COPY Backend/backend/package*.json ./Backend/backend/
COPY Gemini-pipeline/requirements.txt ./Gemini-pipeline/

# Copy Prisma schema before generating client
# Note: NOT copying prisma.config.ts here as it requires DATABASE_URL at runtime
COPY Backend/backend/prisma ./Backend/backend/prisma/

# Install Node.js dependencies
# Skip postinstall script (which runs prisma generate) because it would look for prisma.config.ts
WORKDIR /workspace/Backend/backend
RUN npm ci --only=production --ignore-scripts && \
    npm cache clean --force

# Rebuild native modules (like bcrypt) that were skipped with --ignore-scripts
RUN npm rebuild bcrypt --build-from-source

# Generate Prisma Client manually with schema path
# This works without prisma.config.ts since we're pointing directly to the schema
RUN npx prisma generate --schema=./prisma/schema.prisma

# Set up Python virtual environment for Gemini-pipeline
WORKDIR /workspace/Gemini-pipeline
RUN python3 -m venv .venv && \
    .venv/bin/pip install --no-cache-dir --upgrade pip setuptools wheel && \
    .venv/bin/pip install --no-cache-dir -r requirements.txt && \
    # Verify installation
    .venv/bin/python -c "import google.genai; print('Google GenAI installed successfully')" || true

# Copy Gemini-pipeline directory with explicit structure preservation
WORKDIR /workspace
COPY Gemini-pipeline/ ./Gemini-pipeline/

# Copy backend application code
WORKDIR /workspace/Backend/backend
COPY Backend/backend/src ./src/
COPY Backend/backend/tsconfig.json ./tsconfig.json
# Don't copy prisma.config.ts to avoid config loading issues during deployment
# COPY Backend/backend/prisma.config.ts ./prisma.config.ts
COPY Backend/backend/scripts ./scripts/

# Make Python scripts executable
RUN chmod +x /workspace/Gemini-pipeline/Extraction/inspection_extractor.py && \
    chmod +x /workspace/Gemini-pipeline/Estimation/estimate_builder.py && \
    chmod +x /workspace/Gemini-pipeline/Estimation/generate_estimate_pdf.py

# Switch back to backend directory
WORKDIR /workspace/Backend/backend

# Create temp directory for file processing with proper permissions
RUN mkdir -p temp && \
    chmod 777 temp && \
    # Create .env placeholder files for Gemini-pipeline (will be set via env vars at runtime)
    mkdir -p ../Gemini-pipeline/Extraction ../Gemini-pipeline/Estimation

# Set environment variables
ENV NODE_ENV=production
ENV PORT=8080
ENV GEMINI_PIPELINE_DIR=/workspace/Gemini-pipeline
ENV PYTHONUNBUFFERED=1
ENV PATH="/workspace/Gemini-pipeline/.venv/bin:$PATH"

# Expose the application port
EXPOSE 8080

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Switch to backend directory and run migrations + start server
WORKDIR /workspace/Backend/backend

# Make startup script executable
RUN chmod +x scripts/start.sh

# Run database migrations and start the server using startup script
CMD ["./scripts/start.sh"]
