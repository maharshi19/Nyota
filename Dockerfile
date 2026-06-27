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
ENV PYTHON_EXECUTABLE=/opt/venv/bin/python

COPY package*.json ./
RUN npm ci --omit=dev

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-venv \
  && rm -rf /var/lib/apt/lists/*
COPY requirements.txt ./requirements.txt
RUN python3 -m venv /opt/venv \
  && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
  && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

COPY --from=build /app/dist ./dist
COPY server.js ./server.js
COPY db.js ./db.js
COPY data ./data
COPY models_senior_v4 ./models_senior_v4
COPY utils ./utils

EXPOSE 3009
CMD ["node", "server.js"]
