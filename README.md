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
npx prisma db seed   # creates demo accounts, see below

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

## Demo accounts

Seeded by `prisma db seed` (password is the same for both):

| Role | Email | Password | Business |
|---|---|---|---|
| Owner | `owner@inventoryfy.dev` | `password123` | owns both seeded businesses |
| Staff | `staff@inventoryfy.dev` | `password123` | Northside Hardware |

Businesses seeded: **Northside Hardware** (Retail), **Coastal Wholesale Co.** (Wholesale).

## Auth model

- JWT-based; the token carries `{ sub, role, businessId }`, but every
  request re-checks membership status against the DB (`JwtStrategy`) so a
  suspended account or revoked business access takes effect immediately
  instead of waiting out the token's expiry.
- **Owner** accounts hold an `OWNER` membership on any number of
  businesses and can switch between them (or an aggregate "Owner View")
  from the top bar — no re-login required.
- **Staff** accounts hold a single `STAFF` membership and are fixed to
  that business for the session.
- `BusinessAccessGuard` enforces tenant isolation on any `:businessId`-scoped
  route — this is what every future domain module (catalog, orders, POs,
  ...) sits behind.

## Catalog model

- Every `Product` has ≥1 `ProductVariant` (simple products get a single
  "Default" variant) — SKU/price/stock always live on the variant, never
  duplicated across two code paths. Product-level stock is the sum across
  variants; SKU shown at the product level is the first variant's.
- Bundles (`isBundle: true`) list their components via `BundleComponent`
  (component product + qty) — selling one bundle unit is meant to deduct
  each component's own stock (wired up once Orders exist, Phase 6).
- `lowStockThreshold` drives status: `OUT_OF_STOCK` / `LOW_STOCK` /
  `IN_STOCK`, computed server-side.
- CSV export/import and the product detail screen's warehouse stock,
  batches/serials, landed cost, valuation, suppliers, and stock ledger
  sections are **placeholders** — those need Warehouses (Phase 4),
  Suppliers/POs (Phase 5), and Financials (Phase 7) to have real data.

## Status

Building phase by phase — see the implementation plan for the full
roadmap (Foundations → Auth/Multi-tenancy → Catalog → Warehouses →
Suppliers/POs → Orders/Returns → Financials → Reports → Team/Audit →
Integrations/Deploy).

**Phase 1 (Foundations): done.**
**Phase 2 (Auth & Multi-Tenancy): done.**
**Phase 3 (Catalog): done.**
