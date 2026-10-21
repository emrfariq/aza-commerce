FROM node:24-bookworm-slim
RUN npm install -g pnpm@10.33.0
WORKDIR /app
RUN chown node:node /app
USER node
COPY --chown=node:node . .
ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm install --frozen-lockfile && pnpm --filter @app/frontend run build
WORKDIR /app/apps/frontend
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "exec", "next", "start", "--port", "3000"]
