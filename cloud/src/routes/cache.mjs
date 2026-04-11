import { Router } from 'express';
import { getTenantByApiKey } from '../store.mjs';

export const router = Router();

// Auth middleware — resolves tenant from Bearer token
function auth(req, res, next) {
  const bearer = req.headers.authorization?.replace('Bearer ', '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  const tenant = getTenantByApiKey(bearer);
  if (!tenant) return res.status(401).json({ error: 'invalid api key' });

  req.tenant = tenant;
  next();
}

// Cache set
router.post('/cache-set', auth, (req, res) => {
  const tenant = req.tenant;
  const { key, value, ttl = 43200, original_bytes = null } = req.body;

  if (!key) return res.status(400).json({ error: 'key required' });

  // Enforce plan limits
  if (tenant.cache.size >= tenant.limits.maxKeys) {
    return res.status(429).json({
      error: 'cache limit reached',
      limit: tenant.limits.maxKeys,
      plan: tenant.plan,
      upgrade: tenant.plan === 'free' ? 'Upgrade to Pro for 1000 keys: /api/billing/checkout' : null,
    });
  }

  const effectiveTtl = Math.min(ttl, tenant.limits.maxTtl);
  const valueStr = JSON.stringify(value);

  tenant.cache.set(key, {
    value,
    meta: {
      value_bytes: valueStr.length,
      original_bytes,
      read_count: 0,
      created_at: new Date().toISOString(),
    },
    expires_at: Date.now() + (effectiveTtl * 1000),
  });

  tenant.stats.totalWrites++;

  res.json({ ok: true, key, ttl: effectiveTtl });
});

// Cache get
router.get('/cache-get/:key', auth, (req, res) => {
  const tenant = req.tenant;
  const entry = tenant.cache.get(req.params.key);

  if (!entry || Date.now() > entry.expires_at) {
    if (entry) tenant.cache.delete(req.params.key);
    return res.json({ error: 'cache miss' });
  }

  entry.meta.read_count++;
  tenant.stats.totalReads++;

  // Track token savings
  if (entry.meta.original_bytes && entry.meta.original_bytes > entry.meta.value_bytes) {
    const saved = entry.meta.original_bytes - entry.meta.value_bytes;
    tenant.stats.totalSaved += saved;
  }

  res.json({ key: req.params.key, value: entry.value, meta: entry.meta });
});

// Cache delete
router.delete('/cache-delete/:key', auth, (req, res) => {
  const tenant = req.tenant;
  const deleted = tenant.cache.delete(req.params.key);
  res.json({ ok: true, deleted });
});

// Cache stats
router.get('/cache-stats', auth, (req, res) => {
  const tenant = req.tenant;
  const entries = [];

  for (const [key, entry] of tenant.cache) {
    if (Date.now() > entry.expires_at) {
      tenant.cache.delete(key);
      continue;
    }
    entries.push({
      key,
      value_bytes: entry.meta.value_bytes,
      original_bytes: entry.meta.original_bytes,
      read_count: entry.meta.read_count,
      created_at: entry.meta.created_at,
      tokens_saved: entry.meta.original_bytes
        ? entry.meta.read_count * (entry.meta.original_bytes - entry.meta.value_bytes)
        : 0,
    });
  }

  const totalTokensSaved = entries.reduce((sum, e) => sum + e.tokens_saved, 0);
  const totalReads = entries.reduce((sum, e) => sum + e.read_count, 0);

  res.json({
    plan: tenant.plan,
    entries: entries.length,
    limit: tenant.limits.maxKeys,
    total_reads: totalReads,
    total_tokens_saved: totalTokensSaved,
    estimated_cost_saved: `$${(totalTokensSaved / 100000).toFixed(2)}`,
    entries: entries.sort((a, b) => b.tokens_saved - a.tokens_saved),
  });
});
