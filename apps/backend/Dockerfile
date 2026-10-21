FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* && npm install -g pnpm@10.33.0
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node . .
RUN pnpm install --frozen-lockfile && pnpm --filter @app/backend run prisma:generate && pnpm --filter @app/backend run build
WORKDIR /app/apps/backend
ENV NODE_ENV=production
EXPOSE 4000
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && pnpm run seed && node dist/index.js"]
