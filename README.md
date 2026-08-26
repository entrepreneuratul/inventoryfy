# Inventoryfy

A multi-tenant e-commerce inventory management system, built from the
["Manifold" design mockup](../../Downloads/Multi-tenant%20e-commerce%20inventory%20system/Manifold.dc.html)
(Modernist design system).

## Stack

- **API**: [NestJS](https://nestjs.com) (TypeScript) — `apps/api`
- **Web**: [Next.js](https://nextjs.org) (React) — `apps/web`
- **Database**: PostgreSQL via [Prisma](https://prisma.io)
- **Deploy target**: [Render](https://render.com) (see `render.yaml`)

## Monorepo layout

```
apps/
  api/    NestJS backend, Prisma schema + migrations
  web/    Next.js frontend, componentized from the Modernist mockup
packages/
  design-tokens/   Modernist CSS tokens + component classes (ported from the mockup)
  shared-types/    DTOs/types shared between api and web
```

## Prerequisites

- Node.js 20+
- pnpm (`corepack enable && corepack prepare pnpm@9 --activate`)
- PostgreSQL running locally (or update `DATABASE_URL`)

## Setup

```bash
pnpm install

# API
cp apps/api/.env.example apps/api/.env
# edit apps/api/.env — set DATABASE_URL to your local Postgres
cd apps/api && npx prisma migrate dev

# Web
cp apps/web/.env.example apps/web/.env.local
```

## Running locally

```bash
# terminal 1
pnpm dev:api      # http://localhost:3001

# terminal 2
pnpm dev:web      # http://localhost:3000
```

Check `GET /health` on the API for a DB-connectivity check.

## Status

Building phase by phase — see the implementation plan for the full
roadmap (Foundations → Auth/Multi-tenancy → Catalog → Warehouses →
Suppliers/POs → Orders/Returns → Financials → Reports → Team/Audit →
Integrations/Deploy).

**Phase 1 (Foundations): done.**
