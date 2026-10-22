# Graph Report - aza-commerce (2026-10-22)

## Corpus Check

- Corpus is ~26,090 words - fits in a single context window. You may not need a graph.

## Summary

- 564 nodes · 1112 edges · 22 communities (19 shown, 3 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.88)
- Token cost: unavailable (host agent usage was not exposed; stored zero counters are placeholders)

## Community Hubs (Navigation)

- Frontend Commerce Workspace
- Backend Commerce API
- Architecture and Deployment Contracts
- Backend Dependencies and Tests
- Workspace Tooling and E2E
- Frontend Package Dependencies
- AI Agent Tool Configuration
- Authentication and Browser Origins
- Frontend TypeScript Configuration
- OpenAPI Schema Generation
- Shared TypeScript Compiler Settings
- Backend Development Dependencies
- Database Tables and Indexes
- Backend Lifecycle Scripts
- Isolated Database Test Runner
- Backend TypeScript Configuration
- Backend Build Configuration
- Root TypeScript Configuration
- Source Formatting Rules

## God Nodes (most connected - your core abstractions)

1. `MasterData()` - 22 edges
2. `scripts` - 20 edges
3. `api()` - 19 edges
4. `compilerOptions` - 18 edges
5. `Loading()` - 17 edges
6. `ErrorState()` - 17 edges
7. `compilerOptions` - 17 edges
8. `prisma` - 16 edges
9. `AppError` - 16 edges
10. `rupiah()` - 16 edges

## Surprising Connections (you probably didn't know these)

- `Serena order_management project` --conceptually_related_to--> `Aza Commerce Order Management` [INFERRED]
  .serena/project.yml → README.md
- `CI PostgreSQL 16 service` --conceptually_related_to--> `azatech-postgres database container` [INFERRED]
  .github/workflows/ci.yml → docker-compose.yml
- `REST API contract` --references--> `OpenAPI 3.0.3 and Swagger UI Express` [EXTRACTED]
  docs/api/README.md → README.md
- `createApp()` --indirect_call--> `requireAuth()` [INFERRED]
  apps/backend/src/app.ts → apps/backend/src/middlewares/auth.ts
- `reportOrder()` --calls--> `jakartaDay()` [EXTRACTED]
  apps/backend/tests/integration/business.test.ts → apps/backend/src/utils/validation.ts

## Import Cycles

- None detected.

## Communities (22 total, 3 thin omitted)

### Community 0 - "Frontend Commerce Workspace"

Cohesion: 0.07
Nodes (69): config, ErrorPage(), metadata, RootLayout(), LoginPage(), CustomersPage(), DashboardPage(), ProtectedLayout() (+61 more)

### Community 1 - "Backend Commerce API"

Cohesion: 0.06
Nodes (63): customerNames, names, seed(), adminConfig, seedAdmin(), createApp(), docsRouter, { PORT: port } (+55 more)

### Community 2 - "Architecture and Deployment Contracts"

Cohesion: 0.06
Nodes (33): Browser test failure artifacts, CI PostgreSQL 16 service, Quality checks workflow, Serena order_management project, TypeScript language server and root workspace index, azatech-order Compose stack, Compose backend service, Compose frontend service (+25 more)

### Community 3 - "Backend Dependencies and Tests"

Cohesion: 0.05
Nodes (38): dependencies, bcryptjs, cookie-parser, cors, exceljs, express, jsonwebtoken, @prisma/client (+30 more)

### Community 4 - "Workspace Tooling and E2E"

Cohesion: 0.05
Nodes (36): description, devDependencies, @playwright/test, prettier, @types/node, typescript, engines, node (+28 more)

### Community 5 - "Frontend Package Dependencies"

Cohesion: 0.06
Nodes (30): dependencies, lucide-react, next, react, react-dom, recharts, @tanstack/react-query, devDependencies (+22 more)

### Community 6 - "AI Agent Tool Configuration"

Cohesion: 0.07
Nodes (30): agent, build, plan, disable, permission, headers, type, url (+22 more)

### Community 7 - "Authentication and Browser Origins"

Cohesion: 0.14
Nodes (17): env(), isAllowedBrowserOrigin(), schema, authSession, requireAuth(), checkOrigin(), cookieOptions(), ACCESS_SECONDS (+9 more)

### Community 8 - "Frontend TypeScript Configuration"

Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 9 - "OpenAPI Schema Generation"

Cohesion: 0.15
Nodes (18): authResult, bodyErrors, customerFields, envelope(), id, jsonResponse(), masterPaths(), nullableTimestamp (+10 more)

### Community 10 - "Shared TypeScript Compiler Settings"

Cohesion: 0.11
Nodes (18): compilerOptions, allowSyntheticDefaultImports, declaration, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution (+10 more)

### Community 11 - "Backend Development Dependencies"

Cohesion: 0.11
Nodes (18): devDependencies, @apidevtools/swagger-parser, csv-parse, @faker-js/faker, openapi-types, prisma, supertest, tsx (+10 more)

### Community 12 - "Database Tables and Indexes"

Cohesion: 0.23
Nodes (16): "customers", "order_items", order_items_order_id_idx, order_items_product_id_idx, "orders", orders_created_by_idx, orders_customer_id_order_date_idx, orders_order_date_idx (+8 more)

### Community 13 - "Backend Lifecycle Scripts"

Cohesion: 0.18
Nodes (11): scripts, build, dev, lint, prisma:generate, seed, seed:auth, start (+3 more)

### Community 14 - "Isolated Database Test Runner"

Cohesion: 0.18
Nodes (8): admin, adminUrl, base, commands, e2e, name, require, testEnv

### Community 15 - "Backend TypeScript Configuration"

Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, rootDir, types, extends, include, ../../tsconfig.base.json

### Community 16 - "Backend Build Configuration"

Cohesion: 0.25
Nodes (7): compilerOptions, noEmit, outDir, rootDir, extends, include, ./tsconfig.json

### Community 17 - "Root TypeScript Configuration"

Cohesion: 0.25
Nodes (7): compilerOptions, lib, noEmit, types, extends, include, ./tsconfig.base.json

### Community 18 - "Source Formatting Rules"

Cohesion: 0.29
Nodes (6): endOfLine, printWidth, semi, singleQuote, tabWidth, trailingComma

## Knowledge Gaps

- **32 isolated node(s):** `@faker-js/faker`, `@types/bcryptjs`, `@types/cookie-parser`, `@types/cors`, `@types/express` (+27 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 272 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `Backend Commerce API` to `Backend Dependencies and Tests`, `Isolated Database Test Runner`?**
  _High betweenness centrality (0.024) - this node is a cross-community bridge._
- **What connects `@faker-js/faker`, `@types/bcryptjs`, `@types/cookie-parser` to the rest of the system?**
  _32 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Frontend Commerce Workspace` be split into smaller, more focused modules?**
  _Cohesion score 0.07089108910891088 - nodes in this community are weakly interconnected._
- **Why does `devDependencies` connect `Backend Development Dependencies` to `Backend Dependencies and Tests`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Should `Backend Commerce API` be split into smaller, more focused modules?**
  _Cohesion score 0.060917343526039176 - nodes in this community are weakly interconnected._
- **Why does `express` connect `Backend Commerce API` to `Backend Dependencies and Tests`, `Authentication and Browser Origins`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **Should `Architecture and Deployment Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.06464646464646465 - nodes in this community are weakly interconnected._

## Extraction Audit Notes

- Semantic coverage: all 6 files read completely (960 lines).
- Token cost: unavailable. The host task tool did not expose usage; zero counters are placeholders, not measured zero usage. No external Gemini API was used.
- Four AST files yielded no symbols: `apps/backend/prisma/seed-auth.ts`, `apps/backend/tests/openapi.test.ts`, `apps/frontend/postcss.config.mjs`, `playwright.config.ts`.
- SQL parser installed during this run; SQL extraction rerun.
- Graph integrity diagnostics are saved in `graph_health.json`.
- `graphify-out/` was written into the working tree; unless already ignored, it appears in `git status`. You can add it to `.gitignore` or commit only shared outputs (https://docs.graphify.com/guides/team-workflows).
- Graph health warning: dangling_endpoint_edges = 3.
- Graph health warning: self_loop_edges = 1.
- Graph health warning: directed_same_endpoint_collapsed_edges = 20.
- Graph health warning: undirected_same_endpoint_collapsed_edges = 25.
