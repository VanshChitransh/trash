#!/bin/bash
set -e

echo "=== Starting ConsultaBid Backend ==="
echo "Node version: $(node --version)"
echo "Working directory: $(pwd)"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable is not set!"
    exit 1
fi

echo "✓ DATABASE_URL is set"

# Check if Gemini pipeline directory exists
if [ -d "$GEMINI_PIPELINE_DIR" ]; then
    echo "✓ Gemini pipeline found at: $GEMINI_PIPELINE_DIR"
else
    echo "WARNING: Gemini pipeline directory not found at: $GEMINI_PIPELINE_DIR"
fi

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma

# Start the server
echo "Starting server on port $PORT..."
exec node src/app.js
