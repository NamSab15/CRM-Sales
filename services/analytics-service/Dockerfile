# Stage 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package.json turbo.json package-lock.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY services/lead-service/prisma/schema.prisma ./services/lead-service/prisma/schema.prisma
COPY services/analytics-service ./services/analytics-service

RUN npm ci
RUN npm run build --filter=@crm/analytics-service...

# Stage 2: Runner stage
FROM node:18-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Security: Create non-root group and user
RUN addgroup -g 1001 -S crmgroup && adduser -u 1001 -S crmuser -G crmgroup

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/services/analytics-service/dist ./services/analytics-service/dist
COPY --from=builder /usr/src/app/services/analytics-service/package.json ./services/analytics-service/package.json
COPY --from=builder /usr/src/app/services/lead-service/prisma/schema.prisma ./services/lead-service/prisma/schema.prisma

RUN chown -R crmuser:crmgroup /usr/src/app
USER crmuser

EXPOSE 3008
ENV PORT=3008

CMD ["node", "services/analytics-service/dist/index.js"]