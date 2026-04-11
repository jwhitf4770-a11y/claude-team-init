import { randomBytes, createHash } from 'crypto';

// ─── In-Memory Tenant Store ─────────────────────────────────────────────────
// In production, swap this for Postgres/Redis. For MVP this is fine —
// Fly.io machines persist memory across requests, only reset on deploy.

export const tenants = new Map();

// tenant structure:
// {
//   id: string,
//   email: string,
//   apiKey: string,           // what the CLI sends as Bearer token
//   plan: 'free' | 'pro' | 'team',
//   stripeCustomerId: string | null,
//   stripeSubscriptionId: string | null,
//   createdAt: string,
//   cache: Map<string, CacheEntry>,
//   stats: { totalSaved: number, totalReads: number, totalWrites: number },
//   limits: { maxKeys: number, maxTtl: number },
// }

const PLAN_LIMITS = {
  free:  { maxKeys: 50,   maxTtl: 3600 },     // 1 hour, 50 keys
  pro:   { maxKeys: 1000, maxTtl: 86400 },    // 24 hours, 1000 keys
  team:  { maxKeys: 5000, maxTtl: 172800 },   // 48 hours, 5000 keys
};

export function createTenant(email, plan = 'free') {
  const id = randomBytes(12).toString('hex');
  const apiKey = `ctk_${randomBytes(24).toString('hex')}`;

  const tenant = {
    id,
    email,
    apiKey,
    plan,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    createdAt: new Date().toISOString(),
    cache: new Map(),
    stats: { totalSaved: 0, totalReads: 0, totalWrites: 0 },
    limits: PLAN_LIMITS[plan],
  };

  tenants.set(id, tenant);
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
}
