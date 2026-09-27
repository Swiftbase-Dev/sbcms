# Stage 1: Build the workspace
FROM node:20-alpine AS builder

WORKDIR /app

# Copy admin-sdk dependency
COPY admin-sdk /admin-sdk

# Copy workspace source files
COPY cms /app/cms

# Install dependencies and build
RUN cd /admin-sdk && npm install && npm run build
WORKDIR /app/cms
RUN npm install
RUN if [ "$(uname -m)" = "x86_64" ]; then npm install @rollup/rollup-linux-x64-musl; elif [ "$(uname -m)" = "aarch64" ]; then npm install @rollup/rollup-linux-arm64-musl; fi
RUN npm run build

# Stage 2: Final minimal production image
FROM node:20-alpine

WORKDIR /app

# Copy built admin-sdk and cms workspace
COPY --from=builder /admin-sdk /admin-sdk
COPY --from=builder /app/cms /app/cms

WORKDIR /app/cms/backend

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
