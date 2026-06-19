# Stage 1: Build stage
FROM node:18-alpine AS builder
WORKDIR /usr/src/app

COPY package.json turbo.json package-lock.json ./
COPY packages/shared-types ./packages/shared-types
COPY packages/ui ./packages/ui
COPY services/api-gateway ./services/api-gateway

RUN npm ci
RUN npm run build --filter=@crm/api-gateway...

# Stage 2: Runner stage
FROM node:18-alpine AS runner
WORKDIR /usr/src/app
ENV NODE_ENV=production

# Security: Create non-root group and user
RUN addgroup -g 1001 -S crmgroup && adduser -u 1001 -S crmuser -G crmgroup

COPY --from=builder /usr/src/app/node_modules ./node_modules
COPY --from=builder /usr/src/app/services/api-gateway/dist ./services/api-gateway/dist
COPY --from=builder /usr/src/app/services/api-gateway/package.json ./services/api-gateway/package.json

RUN chown -R crmuser:crmgroup /usr/src/app
USER crmuser

EXPOSE 8000
ENV PORT=8000

CMD ["node", "services/api-gateway/dist/index.js"]