// Demo Storefront — a standalone, independently-run e-commerce app that
// syncs stock with Inventoryfy purely over its public Integrations API.
// Nothing in this file imports anything from the Inventoryfy repo — it
// only ever talks HTTP, the same way a real, separately-deployed Shopify
// or WooCommerce store would.
'use strict';

require('dotenv/config');
const crypto = require('node:crypto');
const path = require('node:path');
const express = require('express');

const PORT = process.env.PORT || 4001;
const STORE_NAME = process.env.STORE_NAME || 'Demo Storefront';
const API_URL = process.env.INVENTORYFY_API_URL || 'http://localhost:3001';
const API_KEY = process.env.INVENTORYFY_API_KEY || '';
const WEBHOOK_SECRET = process.env.INVENTORYFY_WEBHOOK_SECRET || '';

if (!API_KEY || !WEBHOOK_SECRET) {
  console.warn(
    '[storefront] INVENTORYFY_API_KEY / INVENTORYFY_WEBHOOK_SECRET not set — ' +
      'create a connection in Inventoryfy (Admin → Integrations) and copy the ' +
      'one-time values into .env before buying anything.',
  );
}

// In-memory state — this whole app is a disposable demo, not a real store.
/** @type {Map<string, {sku:string, name:string, price:number, availableStock:number}>} */
const catalog = new Map();
const activity = []; // most-recent-first log line strings, capped
let lastSyncedAt = null;

function logActivity(line) {
  activity.unshift({ line, at: new Date().toISOString() });
  activity.length = Math.min(activity.length, 20);
  console.log(`[storefront] ${line}`);
}

async function inventoryfy(pathname, options = {}) {
  const res = await fetch(`${API_URL}${pathname}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
      ...options.headers,
    },
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const message = (isJson && data && data.message) || res.statusText;
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return data;
}

async function refreshCatalog() {
  try {
    const items = await inventoryfy('/integrations/v1/catalog');
    for (const item of items) catalog.set(item.sku, item);
    lastSyncedAt = new Date().toISOString();
  } catch (err) {
    console.warn(`[storefront] Catalog refresh failed: ${err.message}`);
  }
}

const app = express();

// Regular JSON parsing for normal routes...
app.use('/api', express.json());

// ...but the webhook route needs the raw request body to verify the HMAC
// signature, so it gets its own json() with a `verify` hook that stashes
// the exact bytes Inventoryfy signed before they're parsed.
app.use(
  '/webhooks',
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/state', (_req, res) => {
  res.json({
    storeName: STORE_NAME,
    lastSyncedAt,
    items: [...catalog.values()].sort((a, b) => a.name.localeCompare(b.name)),
    activity,
  });
});

app.post('/api/buy', async (req, res) => {
  const { sku, quantity } = req.body || {};
  if (!sku || !quantity || quantity < 1) {
    return res.status(400).json({ error: 'sku and a positive quantity are required' });
  }
  const item = catalog.get(sku);
  if (!item) return res.status(404).json({ error: 'Unknown SKU' });

  const externalOrderId = `${STORE_NAME.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
  try {
    const result = await inventoryfy('/integrations/v1/orders', {
      method: 'POST',
      body: JSON.stringify({
        externalOrderId,
        customerName: `${STORE_NAME} walk-in customer`,
        items: [{ sku, quantity }],
      }),
    });
    logActivity(`Sold ${quantity}× ${item.name} — Inventoryfy order ${result.displayId} (${result.status})`);
    res.json({ ok: true, order: result });
  } catch (err) {
    logActivity(`Checkout failed for ${item.name}: ${err.message}`);
    res.status(502).json({ error: err.message });
  }
});

app.post('/webhooks/inventory', (req, res) => {
  const signature = req.headers['x-inventoryfy-signature'];
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(req.rawBody || Buffer.alloc(0)).digest('hex');

  const valid =
    typeof signature === 'string' &&
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

  if (!valid) {
    logActivity('Rejected a webhook delivery with an invalid signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const payload = req.body;
  if (payload && payload.eventType === 'inventory.updated') {
    const existing = catalog.get(payload.sku);
    catalog.set(payload.sku, {
      sku: payload.sku,
      name: payload.productName,
      price: existing ? existing.price : 0,
      availableStock: payload.availableStock,
    });
    lastSyncedAt = new Date().toISOString();
    logActivity(`Synced from Inventoryfy: ${payload.productName} → ${payload.availableStock} in stock`);
  }

  res.json({ received: true });
});

app.listen(PORT, async () => {
  console.log(`[storefront] ${STORE_NAME} listening on http://localhost:${PORT}`);
  await refreshCatalog();
  // Belt-and-suspenders: webhooks are the near-real-time path, but a
  // periodic reconciliation poll is what a real integration would also
  // run, in case a delivery was ever missed entirely.
  setInterval(refreshCatalog, 30_000);
});
