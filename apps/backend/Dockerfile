FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && npm install -g pnpm@10.33.0
WORKDIR /app
RUN chown node:node /app
USER node
# Keep dependency downloads cached independently from application source changes.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/backend/package.json ./apps/backend/package.json
COPY --chown=node:node apps/backend/prisma ./apps/backend/prisma
RUN --mount=type=cache,id=azatech-pnpm,target=/pnpm/store,uid=1000,gid=1000,sharing=locked \
    pnpm --filter @app/backend... install --frozen-lockfile --store-dir /pnpm/store
COPY --chown=node:node tsconfig.base.json ./
COPY --chown=node:node apps/backend ./apps/backend
RUN pnpm --filter @app/backend run prisma:generate && pnpm --filter @app/backend run build
WORKDIR /app/apps/backend
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm run seed && node dist/index.js"]
