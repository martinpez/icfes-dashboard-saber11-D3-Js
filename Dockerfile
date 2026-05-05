FROM node:18-alpine AS base
WORKDIR /app
COPY package.json ./

FROM base AS production
ENV NODE_ENV=production
RUN npm ci --only=production

FROM base AS development
ENV NODE_ENV=development
RUN npm install

FROM development AS builder
COPY --from=production /app/node_modules /app/node_modules

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
CMD ["node", "server/index.js"]