# 🟢 Use Debian Slim instead of Alpine
FROM node:22-slim

# Install deps (apt instead of apk)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip ffmpeg tesseract-ocr curl git make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Download yt-dlp binary
RUN curl -L -o /usr/local/bin/yt-dlp \
    "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp" && \
    chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --production
COPY . .
RUN npm run build

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS="--max-old-space-size=4096"

RUN mkdir -p /shared-files /app/downloads && chmod -R 777 /shared-files /app/downloads

EXPOSE 3000
CMD ["npm", "run", "start"]
