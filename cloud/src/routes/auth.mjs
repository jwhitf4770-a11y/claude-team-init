import { Router } from 'express';
import { createTenant, getTenantByEmail } from '../store.mjs';

export const router = Router();

// Sign up — creates a free tenant and returns API key
router.post('/signup', (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email required' });

  // Check if already exists
  const existing = getTenantByEmail(email);
  if (existing) {
    return res.json({
      id: existing.id,
      apiKey: existing.apiKey,
      plan: existing.plan,
      message: 'Account already exists. Here is your API key.',
    });
  }

  const tenant = createTenant(email, 'free');

  res.json({
    id: tenant.id,
    apiKey: tenant.apiKey,
    plan: tenant.plan,
    message: 'Account created. Use this API key in your cache-hook.sh.',
    setup: `scripts/cache-hook.sh set-token ${tenant.apiKey}`,
  });
});

// Get account info
router.get('/me', (req, res) => {
  const tenant = req.tenant;
  if (!tenant) return res.status(401).json({ error: 'unauthorized' });

  res.json({
    id: tenant.id,
    email: tenant.email,
    plan: tenant.plan,
    limits: tenant.limits,
    stats: tenant.stats,
    cacheEntries: tenant.cache.size,
    createdAt: tenant.createdAt,
  });
});
