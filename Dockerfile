# --- build the SPA ---
FROM node:25-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# --- runtime: zero-dependency Node server ---
FROM node:25-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_DIR=/data DIST_DIR=/app/dist
COPY --from=build /app/dist ./dist
COPY server ./server
RUN apk add --no-cache su-exec && mkdir -p /data && chown node:node /data
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
VOLUME /data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server/index.mjs"]
