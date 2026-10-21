FROM node:24-bookworm-slim AS dependencies
RUN npm install -g pnpm@10.33.0
WORKDIR /app
RUN chown node:node /app
USER node
# The frontend does not need Prisma engines or backend development dependencies.
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --chown=node:node apps/frontend/package.json ./apps/frontend/package.json
# Keep frontend native packages isolated and verify cached content before linking.
RUN --mount=type=cache,id=azatech-pnpm-frontend,target=/pnpm/store,uid=1000,gid=1000,sharing=locked \
    pnpm --filter @app/frontend... install --frozen-lockfile --prefer-offline --store-dir /pnpm/store --verify-store-integrity

FROM dependencies AS app
COPY --chown=node:node apps/frontend ./apps/frontend
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @app/frontend run build
WORKDIR /app/apps/frontend
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "--port", "3000"]
