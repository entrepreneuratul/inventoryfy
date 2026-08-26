# Demo storefronts

Two standalone, independently-run e-commerce apps — **not** part of the
Inventoryfy pnpm workspace, no shared code, no shared dependencies. They
exist to prove Inventoryfy's Integrations API works against something
genuinely external, the same way a real Shopify/WooCommerce/custom store
would connect. See the main [README](../README.md#integrations-model)
for the full model and a step-by-step walkthrough.

## Quickstart

1. Run Inventoryfy's API + web app as usual (see the root README).
2. Log in as Owner → **Integrations** → **New connection**, once for each:
   - "Storefront A", webhook `http://localhost:4001/webhooks/inventory`
   - "Storefront B", webhook `http://localhost:4002/webhooks/inventory`
3. Each creation reveals an API key + webhook secret **once** — copy them
   into that storefront's `.env` (copy `.env.example` to `.env` first).
4. In each folder: `npm install && npm run dev`.
5. Open both storefronts' pages. Buy something on one — the other's
   stock updates on its own within about a second, via webhook, with no
   direct interaction between them.

## What's actually happening

- **Buy** → the storefront's own server calls Inventoryfy's
  `POST /integrations/v1/orders` with its API key. Inventoryfy creates a
  real order and decrements real stock.
- Inventoryfy then `POST`s an HMAC-signed `inventory.updated` webhook to
  **every** connected storefront — including the one that didn't sell
  anything — which is what keeps both converged on one true stock number.
- Each storefront verifies the signature (`X-Inventoryfy-Signature`, HMAC-SHA256 over the raw body with its own webhook secret) before trusting a delivery.
- A short polling refresh (every 30s) is a fallback reconciliation in
  case a webhook delivery is ever missed — belt and suspenders, same as
  a real integration would run.

Everything here is disposable — in-memory state, no database. Restarting
a storefront just re-pulls the current catalog from Inventoryfy.
