# --- Builder Stage ---
FROM node:18-alpine AS builder

WORKDIR /app

# Copy config files
COPY package*.json tsconfig.json ./
COPY prisma ./prisma/

# Install dependencies (clean ci is better for reproducible builds)
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# --- Runner Stage ---
FROM node:18-alpine

WORKDIR /app

# Set to production environment
ENV NODE_ENV=production

# Security: Don't run as root
USER node

# Copy files from builder, setting ownership to the 'node' user
COPY --from=builder --chown=node:node /app/package*.json ./
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/prisma ./prisma

EXPOSE 3000

CMD ["node", "dist/server.js"]