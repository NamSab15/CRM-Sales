# Stage 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package.json turbo.json package-lock.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web

RUN npm ci
RUN npm run build --filter=@crm/web...

# Stage 2: Runner stage
FROM node:18-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Security: Create non-root group and user
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Copy standalone build outputs
COPY --from=builder /usr/src/app/apps/web/.next/standalone ./
COPY --from=builder /usr/src/app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /usr/src/app/apps/web/public ./apps/web/public

RUN chown -R nextjs:nodejs /usr/src/app
USER nextjs

EXPOSE 3000
ENV PORT=3000

# Standalone output exposes a server.js in the root
CMD ["node", "server.js"]
