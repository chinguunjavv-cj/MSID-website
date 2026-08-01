# MSID website container.
#
# Node 24 is the floor: the app uses the built-in `node:sqlite` module and runs the
# seed scripts through Node's native TypeScript stripping. Neither exists on Node 20.
FROM node:24-slim

WORKDIR /app
ENV NODE_ENV=production

# Dependencies first, so a content-only change does not reinstall them.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# Writable state lives on a mounted volume, never in the image: the SQLite file and
# everything the administrator uploads. Both survive redeploys.
ENV MSID_DB_PATH=/data/msid.db
ENV MSID_UPLOAD_DIR=/data/uploads
VOLUME ["/data"]

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# See scripts/docker-entrypoint.sh — seeds the schema and first administrator, then
# starts the server. Idempotent, so it is safe on every restart.
CMD ["sh", "scripts/docker-entrypoint.sh"]
