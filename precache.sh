#!/bin/bash
set -e

mkdir -p /tmp/cache-client
cp backend/tests/fixtures/mern-sample/client/package*.json /tmp/cache-client/
cat << 'EOF' > /tmp/cache-client/Dockerfile
FROM node:18-slim AS build
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install; fi
EOF

cd /tmp/cache-client
docker build -t cache-client .

mkdir -p /tmp/cache-server
cp backend/tests/fixtures/mern-sample/server/package*.json /tmp/cache-server/
cat << 'EOF' > /tmp/cache-server/Dockerfile
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install; fi
EOF

cd /tmp/cache-server
docker build -t cache-server .

echo "Cache populated!"
