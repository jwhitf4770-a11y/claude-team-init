import { randomBytes } from 'crypto';
import { readFileSync, writeFileSync, renameSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Tenant store, persisted to one JSON file ────────────────────────────────
// Fly stops idle machines (auto_stop, min_machines_running = 0), so memory alone is
// wiped on every idle. Everything (tenants, API keys, cache, stats) is written through
// to DATA_DIR/store.json, which on Fly is a mounted volume (see fly.toml [mounts]).
// ponytail: whole-file rewrite, coalesced to one write per 200ms. Fine at plan limits
// (<= 5000 small digests per tenant); move to SQLite if a tenant outgrows that.

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), 'data');
const DATA_FILE = join(DATA_DIR, 'store.json');

export const tenants = new Map();

// tenant structure:
// {
//   id, email, apiKey (Bearer token), plan: 'free' | 'pro' | 'team',
//   stripeCustomerId, stripeSubscriptionId, createdAt,
//   cache: Map<string, CacheEntry>,
//   stats: { totalSaved, totalReads (hits), totalMisses, totalWrites },
//   limits: { maxKeys, maxTtl },
// }

const PLAN_LIMITS = {
  free:  { maxKeys: 50,   maxTtl: 3600 },     // 1 hour, 50 keys
  pro:   { maxKeys: 1000, maxTtl: 86400 },    // 24 hours, 1000 keys
  team:  { maxKeys: 5000, maxTtl: 172800 },   // 48 hours, 5000 keys
};

const newStats = () => ({ totalSaved: 0, totalReads: 0, totalMisses: 0, totalWrites: 0 });

export function createTenant(email, plan = 'free', apiKey = `ctk_${randomBytes(24).toString('hex')}`) {
  const id = randomBytes(12).toString('hex');
  const tenant = {
    id,
    email,
    apiKey,
    plan,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: new Date().toISOString(),
    cache: new Map(),
    stats: newStats(),
    limits: PLAN_LIMITS[plan],
  };
  tenants.set(id, tenant);
  persist();
  return tenant;
}

export function getTenantByApiKey(apiKey) {
  for (const [, tenant] of tenants) {
    if (tenant.apiKey === apiKey) return tenant;
  }
  return null;
}

export function getTenantByEmail(email) {
  for (const [, tenant] of tenants) {
    if (tenant.email === email) return tenant;
  }
  return null;
}

export function getTenantByStripeCustomerId(customerId) {
  for (const [, tenant] of tenants) {
    if (tenant.stripeCustomerId === customerId) return tenant;
  }
  return null;
}

export function upgradeTenant(tenant, plan) {
  tenant.plan = plan;
  tenant.limits = PLAN_LIMITS[plan];
  persist();
}

// ─── persistence ─────────────────────────────────────────────────────────────
let timer = null;
export function persist() {
  if (!timer) timer = setTimeout(flush, 200);
}

export function flush() {
  clearTimeout(timer);
  timer = null;
  const now = Date.now();
  const data = {
    tenants: [...tenants.values()].map(t => ({
      ...t,
      cache: [...t.cache].filter(([, e]) => e.expires_at > now),
    })),
  };
  mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, DATA_FILE); // atomic: a crash mid-write never leaves a torn store.json
}

function load() {
  let raw;
  try {
    raw = readFileSync(DATA_FILE, 'utf-8');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    return;
  }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    // Keep the unreadable file instead of overwriting it with an empty store.
    const aside = `${DATA_FILE}.corrupt-${Date.now()}`;
    renameSync(DATA_FILE, aside);
    console.error(`store.json unreadable, moved to ${aside}; starting empty`);
    return;
  }
  for (const t of data.tenants || []) {
    t.cache = new Map(t.cache || []);
    t.stats = { ...newStats(), ...t.stats };
    t.limits = PLAN_LIMITS[t.plan] || PLAN_LIMITS.free;
    tenants.set(t.id, t);
  }
}

load();

// Self-hosted (one project per server, as `claude-team-init` deploys it): the Bearer
// token is the MCP_TOKEN secret. Keep one tenant bound to it, re-keyed if it rotates.
if (process.env.MCP_TOKEN) {
  const self = getTenantByEmail('self-hosted');
  if (!self) createTenant('self-hosted', 'pro', process.env.MCP_TOKEN);
  else if (self.apiKey !== process.env.MCP_TOKEN) { self.apiKey = process.env.MCP_TOKEN; persist(); }
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => { if (timer) flush(); process.exit(0); });
}
