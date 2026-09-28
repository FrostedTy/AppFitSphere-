# Build determinístico do cliente Prisma e poda de dependências de desenvolvimento.
FROM node:22-bookworm-slim AS build

WORKDIR /app
ENV PRISMA_CLI_QUERY_ENGINE_TYPE=binary

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npm run prisma:generate

COPY src ./src
RUN npm prune --omit=dev && npm cache clean --force

# Runtime não-root: as migrações são aplicadas pelo preDeploy do Render,
# antes de substituir a instância que atende tráfego.
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=10000 \
    PRISMA_CLI_QUERY_ENGINE_TYPE=binary

WORKDIR /app
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/src ./src

USER node
EXPOSE 10000

CMD ["npm", "start"]
