# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    set -eu; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    ONNXRUNTIME_NODE_INSTALL=skip npm ci --strict-ssl=true --no-audit --no-fund

COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY public ./public
COPY server ./server
COPY scripts/fetch-wall-model.mjs ./scripts/
COPY models/SOURCES.md models/UPERNET-LICENSE.txt models/wall-segmentation-int8.onnx ./models/
RUN --mount=type=secret,id=proxy_ca \
    set -eu; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm run model:fetch
RUN npm run build

FROM node:24-bookworm-slim AS runtime

ENV NODE_ENV=production \
    PORT=3001 \
    NPM_CONFIG_CACHE=/tmp/.npm
WORKDIR /app

COPY --chown=node:node package.json package-lock.json ./
RUN --mount=type=secret,id=proxy_ca \
    set -eu; \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    ONNXRUNTIME_NODE_INSTALL=skip npm ci --omit=dev --strict-ssl=true --no-audit --no-fund; \
    npm cache clean --force

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/server ./server
COPY --from=build --chown=node:node /app/src/lib ./src/lib

COPY --from=build --chown=node:node /app/models ./models

USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node --input-type=module -e "const r=await fetch('http://127.0.0.1:'+(process.env.PORT||'3001')+'/api/health');if(!r.ok||(await r.json()).ok!==true)process.exit(1)"

CMD ["npm", "start"]
