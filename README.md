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
demo-storefronts/
  storefront-a/    Standalone Node/Express demo storefront — NOT part of
  storefront-b/     the pnpm workspace, no shared code with api/web. Proves
                     the Integrations API against something genuinely
                     external. See "Integrations model" below.
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
- CSV export/import and the product detail screen's landed cost,
  valuation, suppliers, and stock ledger sections remain **placeholders**
  — those need Suppliers/POs (Phase 5) and Financials (Phase 7).
  Warehouse stock, batches, and serials are real as of Phase 4.

## Warehouses & inventory model

- `WarehouseStock` (warehouse × variant → qty) is the source of truth for
  "where is this stock"; `ProductVariant.stock` is a denormalized total
  kept in sync by every mutating op (`adjust`, transfer, cycle-count
  submit) inside the same DB transaction.
- Stock that predates any warehouse — or a variant nobody has allocated
  yet — has no `WarehouseStock` row. It's surfaced as **Unallocated** on
  the product page rather than hidden, so totals always reconcile.
- Transfers are atomic and instant (decrement source + increment
  destination in one transaction); an over-transfer is rejected with a
  clear 400 rather than going negative.
- Cycle counts snapshot `expected` qty per variant when started
  (`counted` defaults to `expected`); submitting applies the variance
  (`counted - expected`) as a stock adjustment and marks the count
  `COMPLETED`. Only one count can be in progress per warehouse at a time.
- Batches (lot + expiry, status `FRESH`/`EXPIRING_SOON`/`EXPIRED`
  computed server-side) and serial numbers (+ warranty) are tracked
  per-variant; both are manually added for now — automatic creation
  during PO receiving is a natural follow-up, not yet wired in.

## Suppliers & purchase orders model

- PO status flow: `DRAFT` (needs approval) → `SENT` → `PARTIAL` →
  `RECEIVED` → `CLOSED`. "Approve & send" moves DRAFT→SENT in one step,
  matching the mockup.
- Receiving a PO reuses `InventoryService.applyDelta` inside the PO's own
  transaction — the same stock-adjustment primitive Warehouses uses — so
  receiving is just "warehouses" plus PO bookkeeping (`receivedQty`),
  never a second code path for touching stock. Partial receiving is
  supported (receive across multiple visits); over-receiving past the
  ordered qty is rejected.
- Supplier `onTimePercent` and price `trend` are **computed**, not
  stored: on-time compares `receivedAt` to `expectedDate` on
  RECEIVED/CLOSED POs; trend compares the average unit cost of a
  supplier's last two POs (>2% move either way = Rising/Falling).
- `billStatus` (NONE/UNPAID/PARTIAL/PAID) is tracked per PO but is a
  simple manual field for now — real AP/GL accounting lands in Phase 7.
- Reorder suggestions are threshold-based (current stock ≤
  `lowStockThreshold`); velocity-based suggestions need Reports (Phase 8).

## Orders & returns model

- Order status flow: `PROCESSING` → `SHIPPED` → `DELIVERED` (or
  `CANCELLED` from either of the first two); `BACKORDERED` is a
  fulfillment-time fallback, not a manual status.
- Creating an order **flattens bundle line items into their components**
  (`stock-fulfillment.ts`, shared by orders and returns) before touching
  stock — selling a kit decrements each component via the same
  `InventoryService.applyDelta` primitive everything else uses, never the
  bundle's own (untracked) stock.
- Stock sufficiency is checked by *attempting* the decrement inside a
  transaction: if any line goes negative, the transaction rolls back
  automatically and the order is created as `BACKORDERED` instead, with
  nothing decremented. Insufficient stock is evaluated per-warehouse
  (against `WarehouseStock`, not the variant's total-across-warehouses
  figure) — an order can legitimately backorder even when a product's
  total stock looks sufficient, if none of it is allocated to the
  fulfillment warehouse.
- Cancelling a `PROCESSING`/`SHIPPED` order restores stock via the same
  flattening logic (reversed); cancelling a `BACKORDERED` order restores
  nothing, since nothing was ever decremented.
- Returns (RMA) flow: `REQUESTED` → `APPROVED` → `RECEIVED` →
  `REFUNDED`, only reachable from a `DELIVERED` order's line item (one
  return per item). The `RECEIVED` → `REFUNDED` decision is
  restock-or-scrap; restocking reuses the same bundle-aware stock helper
  once more, into a warehouse the caller chooses.

## Financials model

- **Valuation (FIFO/LIFO/Weighted-avg)** is computed from real cost
  layers built out of `PurchaseOrderItem.receivedQty` history (oldest →
  newest), not stored: FIFO values current stock as the *newest* layers
  (oldest assumed sold first), LIFO as the *oldest* layers (newest
  assumed sold first), weighted-avg blends every layer's cost across all
  current stock. Stock with no PO-receipt history (predates purchasing,
  or was seeded directly) falls back to the linked supplier's quoted
  cost, or $0 with an explicit on-screen note if there's no supplier
  link — never silently fabricated.
- **Landed cost** = the same weighted-average base cost + fixed
  freight (8%) / duty (5%) percentages.
- **COGS** (for P&L) uses the weighted-average unit cost per product,
  applied to every DELIVERED order line, net of any item that was later
  `REFUNDED` (returns reverse both revenue and COGS recognition).
- **AP** = open (`UNPAID`/`PARTIAL`) purchase-order bill totals.
  **AR** = `DELIVERED`-or-later orders marked `UNPAID` (the "invoiced
  B2B customer" case — most orders default `PAID`, matching upfront
  marketplace/website checkout).
- **GST breakdown** groups delivered, non-refunded order lines by their
  product's `taxRatePercent` (editable per product, default 0).
- The transaction log merges three real event streams — Sales
  (delivered orders), Refunds (refunded returns), Supplier payments
  (POs marked `PAID`) — sorted by date, capped at 50 rows.
- `GET /financials/summary` is the one endpoint in the app that isn't
  `:businessId`-scoped: it's owner-only (`RolesGuard`) and aggregates
  `forBusiness()` across every business the caller owns, the same
  authorization shape as `/auth/me`. Every other Financials route,
  and single-business callers of the aggregate logic, share the exact
  same `forBusinesses()` code path — an array of one business is just
  the degenerate case.

## Reports & dashboard model

- **Dashboard** has two real shapes, not one screen with hidden rows:
  `GET /businesses/:businessId/dashboard` (single business — today's
  sales, cash position, pending POs/bills, low-stock alerts, a recent-
  activity feed synthesized from actual recent orders/POs/returns) and
  owner-only `GET /dashboard/summary` (consolidated banner + a
  per-business breakdown card, same `RolesGuard`-not-`BusinessAccessGuard`
  shape as `/financials/summary`).
- **Cash position** is a simple proxy, not a real ledger: revenue
  actually collected (paid + delivered, net of refunds) minus what's
  actually been paid out to suppliers. There's no bank-account model in
  this app, so this is the two cash-affecting flows it does track.
- **Sales velocity** = units sold (delivered, net of refunds) in the
  trailing 30 days, labeled "N units/mo". Best-sellers and dead stock
  are the same computation sorted in opposite directions — dead stock
  additionally requires stock on hand (0-stock items aren't "dead",
  they're sold out).
- **Turnover** = 30-day revenue ÷ current inventory valuation (reuses
  `FinancialsService.valuation()` in `WEIGHTED` mode), one row per
  business. Trend compares this 30-day ratio against the prior 30 days
  (>10% move = Rising/Falling), the same trend pattern as suppliers'
  price trend in Phase 5.
- **Scheduled reports** are persisted for real (`ScheduledReport`) —
  the ask is genuinely saved and listed back — but actual email
  delivery is infrastructure that lands with Notifications (Phase 9);
  the UI says so rather than implying it already sends.

## Team, notifications & audit model

- **Two roles, on purpose, not by accident.** `Membership.role`
  (OWNER/STAFF) is the Phase 2 login/tenancy role and stays untouched —
  it decides which login mode a user gets and gates the
  `BusinessAccessGuard`/owner-aggregate split used everywhere from
  Financials to Reports. `Membership.teamRole` (OWNER, Business Admin,
  Inventory Manager, Sales Staff, Accountant) is new, orthogonal, and
  only decides fine-grained capabilities inside a business. A STAFF
  login with `teamRole: ACCOUNTANT` still logs in the STAFF way; it
  just can't touch inventory. Keeping these separate meant Phase 9
  never had to touch the Phase 2 auth foundation to add a 5-role
  capability model on top of it.
- **Capability enforcement is representative, not exhaustive.** A
  `CapabilityGuard` + `@RequireCapability(...)` decorator pair checks
  `req.user.teamRole` (re-derived from the DB on every request, same
  as the rest of the auth model — a suspended or re-roled user is cut
  off immediately, no re-login needed) against a five-capability
  matrix. It's wired onto a deliberately chosen high-value set of
  routes — PO approval, Financials viewing, Catalog mutations, and the
  new Team endpoints — rather than retrofitted across all ~80 existing
  endpoints. That's a scope call, made explicitly: the guard is a
  no-op on any route without `@RequireCapability`, so it's safe to
  extend to more routes later without changing its behavior anywhere
  it's already applied.
- **`@inventoryfy/shared-types` has no build step** (`"main":
  "src/index.ts"`) — Next.js bundles that fine at runtime, but Nest's
  `nest build` does not bundle `node_modules`, so a real runtime
  `import { X } from '@inventoryfy/shared-types'` in backend code
  breaks the compiled `dist/` with `ERR_MODULE_NOT_FOUND`. Only
  `import type` (erased at compile time) is safe from that package on
  the backend. `CAPABILITY_MATRIX` and `ALERT_TYPE_LABELS` are small
  runtime constants the backend genuinely needs, so each is duplicated
  locally (`apps/api/src/auth/capability-matrix.ts`, a local const in
  `notifications.service.ts`) with a comment pointing back at the
  shared-types original to keep them in sync by hand.
- **Audit log is a global interceptor, not scattered logging calls.**
  `AuditInterceptor` is registered once via `APP_INTERCEPTOR` and
  fires after every mutating request (`POST`/`PATCH`/`PUT`/`DELETE`)
  under `/businesses/:businessId/...`, deriving `entity` from the
  route path and `userName`/`userEmail`/`businessId` from the already-
  authenticated request — no per-endpoint instrumentation anywhere
  else in the codebase. Write failures are caught and logged rather
  than allowed to fail the request they're auditing.
- **Notification "digest" is honest about what it does.** `Send
  digest now` only evaluates alert types it can actually compute from
  real current state — LOW_STOCK and OUT_OF_STOCK, from live product
  stock — and only queues a `NotificationLogEntry` per ACTIVE
  membership whose `teamRole` is in that alert's configured recipient
  list. NEW_ORDER, SUPPLIER_BILL_OVERDUE, and PAYMENT_DUE are modeled
  in the schema and configurable in the UI but deliberately not wired
  to fire automatically — that needs event hooks into many existing
  mutation paths across Orders/Suppliers/Financials, which is scope
  for a later pass, not Phase 9. `SENT` means "channel enabled and an
  eligible recipient was found," not "delivered by real email/WhatsApp
  infrastructure" — there is none yet, and the UI doesn't claim
  otherwise.

## Integrations model

Inventoryfy plugs into independently-run e-commerce storefronts the same
way a channel connects to a third-party inventory platform like Zoho
Inventory — not a specific platform's API (Shopify, WooCommerce, ...), a
generic contract any storefront can implement. Inventoryfy stays the
single source of truth for stock; a connected storefront never owns it.

- **The contract, both directions.** A storefront registers as an
  `IntegrationConnection` and gets an API key (inbound auth) and a
  webhook signing secret (outbound auth) — shown exactly once, the same
  one-time-reveal pattern as a Team invite's temporary password. Inbound:
  the storefront `POST`s `/integrations/v1/orders` (SKUs + quantities,
  keyed by its own `externalOrderId`) whenever it takes a sale; Inventoryfy
  creates a real `Order` through the same `OrdersService.create()` every
  other order in the app goes through, so bundle expansion, backorder
  fallback, and stock decrement are all identical to an order placed
  in-app — nothing about integration orders is a separate code path.
  Outbound: any stock change anywhere in Inventoryfy — a sale on another
  channel, a PO receipt, a return, a manual count — fans out an
  HMAC-signed `inventory.updated` webhook to every connected storefront
  within about a second, which is what actually keeps multiple channels
  from overselling the same unit.
- **Bundles report real, computed availability — not their own stale
  stock column.** A bundle Product's own `ProductVariant.stock` is never
  meaningful (a bundle sale decrements its components, never its own
  row — see `stock-fulfillment.ts`'s doc comments), so both the catalog
  endpoint and the outbound webhook use `computeBundleAvailableStock()`
  (`min(componentStock ÷ qty needed)` across components) instead. And
  when a *shared* component's stock changes — one item used by several
  bundles, e.g. a samagri item used in three different festival kits —
  every bundle that includes it gets its own recomputed `inventory.updated`
  event too, not just the component's own SKU. This is what makes a
  storefront selling bundles (not just flat SKUs) work correctly, not
  just one selling single products.
- **Idempotent inbound, retried outbound.** A redelivered order webhook
  with the same `externalOrderId` is a no-op (a real unique constraint on
  `Order.(sourceConnectionId, externalOrderId)`, not just an
  application-level check), so a storefront can safely retry on timeout
  without risking a double sale. Outbound delivery retries 3 times with a
  short backoff before being logged FAILED — enough to ride out a
  storefront's brief restart, but a real deployment would want this on a
  durable retry queue instead of in-process retries that vanish on an API
  restart.
- **No module cycle, on purpose.** Stock-mutating services (Orders,
  Returns, PurchaseOrders, Inventory) and `IntegrationsService` never
  import each other — they'd form a cycle (Warehouses → Integrations →
  Orders → Warehouses). Both sides instead depend on one small, global,
  dependency-free `StockChangeEmitter` ([stock-change-emitter.ts](apps/api/src/common/stock-change-emitter.ts)):
  mutating services publish a variantId *after* their own transaction
  commits — never from inside `InventoryService.applyDelta` itself,
  since that runs mid-transaction and the caller's transaction can still
  roll back afterwards (see `OrdersService.create`'s backorder fallback).
- **Every sync attempt is logged**, success or failure, in
  `IntegrationEventLog` — visible on the Integrations page's sync log —
  same "make failures visible" principle as the Phase 9 audit log. A
  paused connection's API key is rejected outright (401), not silently
  ignored.
- **The two demo storefronts prove the contract, not the platform.**
  `demo-storefronts/storefront-{a,b}` are standalone Node/Express apps,
  deliberately outside the pnpm workspace with zero shared code — they
  only ever speak plain HTTP to Inventoryfy, the same as a real,
  separately-deployed store would. Run both, sell on one, and watch the
  other's stock count update on its own within about a second:

  ```bash
  # Terminal 1 — Inventoryfy API + web already running (see "Running locally")

  # Terminal 2
  cd apps/api && npx prisma studio # optional, to watch rows change live

  # In the Inventoryfy web app: log in as Owner, go to Integrations, and
  # create two connections —
  #   "Storefront A", webhook http://localhost:4001/webhooks/inventory
  #   "Storefront B", webhook http://localhost:4002/webhooks/inventory
  # Each create reveals an API key + webhook secret ONCE — copy them into
  # demo-storefronts/storefront-a/.env and storefront-b/.env respectively
  # (copy .env.example to .env first in each).

  cd demo-storefronts/storefront-a && npm install && npm run dev   # :4001
  cd demo-storefronts/storefront-b && npm install && npm run dev   # :4002
  ```

  Open both storefronts' pages side by side. Buying on one decrements
  real stock in Inventoryfy, and both storefronts converge on the new
  number — the one that sold it confirms its own sale, the other learns
  about it purely from the webhook, with no direct interaction.

## Status

Building phase by phase — see the implementation plan for the full
roadmap (Foundations → Auth/Multi-tenancy → Catalog → Warehouses →
Suppliers/POs → Orders/Returns → Financials → Reports → Team/Audit →
Integrations → Polish/Deploy). The original Phase 10 ("Integrations,
Polish & Deploy") turned out to be two phases' worth of work once
integrations were scoped for real, so it split: Phase 10 is
Integrations, Phase 11 is Polish & Deploy (Render).

**Phase 1 (Foundations): done.**
**Phase 2 (Auth & Multi-Tenancy): done.**
**Phase 3 (Catalog): done.**
**Phase 4 (Warehouses & Inventory): done.**
**Phase 5 (Suppliers & Purchase Orders): done.**
**Phase 6 (Orders & Returns): done.**
**Phase 7 (Financials): done.**
**Phase 8 (Reports & Dashboards): done.**
**Phase 9 (Team, Notifications & Audit): done.**
**Phase 10 (Integrations): done.**
**Phase 11 (Polish & Deploy): not started.**
