# Stage 1: Build the workspace
FROM node:20-alpine AS builder

WORKDIR /app

# Copy SDKs and the CMS workspace
COPY admin-sdk /app/admin-sdk
COPY sdk /app/sdk
COPY cms /app/cms

# Build admin-sdk
WORKDIR /app/admin-sdk
RUN npm install
RUN npm run build

# Build sdk
WORKDIR /app/sdk
RUN npm install
RUN npm run build

# Build CMS workspace
WORKDIR /app/cms
RUN npm install
RUN npm run build

# Stage 2: Final minimal production image
FROM node:20-alpine

WORKDIR /app

# Copy built SDKs and CMS workspace
COPY --from=builder /app/admin-sdk /app/admin-sdk
COPY --from=builder /app/sdk /app/sdk
COPY --from=builder /app/cms /app/cms

WORKDIR /app/cms/backend

EXPOSE 3000

ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

CMD ["node", "dist/index.js"]
