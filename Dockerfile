# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY server.js ./server.js
COPY db.js ./db.js
COPY data ./data
COPY models_senior_v4 ./models_senior_v4
COPY utils ./utils

EXPOSE 3009
CMD ["node", "server.js"]
