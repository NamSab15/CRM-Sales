# Stage 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package.json turbo.json package-lock.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY services/lead-service/prisma/schema.prisma ./services/lead-service/prisma/schema.prisma
COPY services/user-service ./services/user-service

RUN npm ci
RUN npm run build --filter=@crm/user-service...

# Stage 2: Runner stage
FROM node:18-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Security: Create non-root group and user
RUN addgroup -g 1001 -S crmgroup && adduser -u 1001 -S crmuser -G crmgroup

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/services/user-service/dist ./services/user-service/dist
COPY --from=builder /usr/src/app/services/user-service/package.json ./services/user-service/package.json
COPY --from=builder /usr/src/app/services/lead-service/prisma/schema.prisma ./services/lead-service/prisma/schema.prisma

RUN chown -R crmuser:crmgroup /usr/src/app
USER crmuser

EXPOSE 3005
ENV PORT=3005

CMD ["node", "services/user-service/dist/index.js"]