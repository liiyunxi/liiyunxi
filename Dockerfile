# JobHunter Pro - Production Dockerfile
# Multi-stage build for optimized image size

# Stage 1: Dependencies
FROM node:20-alpine AS deps

RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    python3 \
    make \
    g++ \
    cairo \
    curl \
    wget \
    unzip

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production && \
    npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npm run build --if-present || true

# Stage 3: Production
FROM node:20-alpine AS production

RUN apk add --no-cache \
    chromium \
    chromium-chromedriver \
    dumb-init \
    nginx \
    curl

ENV NODE_ENV=production \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    PORT=3000

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package*.json ./

RUN mkdir -p /app/src/web && \
    cp -r src/* /app/src/ && \
    chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

CMD ["node", "src/server.js"]
