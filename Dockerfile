# Use official Node.js LTS Alpine image
FROM node:22-alpine

# Add community repo and install build + OCR dependencies
RUN apk add --no-cache \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    bash \
    git \
    python3 \
    make \
    g++ \
    libc6-compat

# Set working directory
WORKDIR /app

# Copy dependency files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of your app
COPY . .

# Build the Next.js app
RUN npm run build

# ✅ Disable Next.js telemetry & enable Node streaming
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=4096"

# ✅ Create and set permissions for upload folder
RUN mkdir -p /shared-files && chmod -R 777 /shared-files

# Expose port
EXPOSE 3000

# ✅ Use production server (not dev) – streams correctly
CMD ["npm", "run", "start"]
