import express from 'express';
import bodyParser from 'body-parser';
import { router as cacheRouter } from './routes/cache.mjs';
import { router as authRouter } from './routes/auth.mjs';
import { router as billingRouter, webhookHandler } from './routes/billing.mjs';
import { router as dashboardRouter } from './routes/dashboard.mjs';
import { tenants } from './store.mjs';

const app = express();
const PORT = process.env.PORT || 8080;

// Stripe webhook needs raw body — must come before bodyParser
app.post('/webhook/stripe', bodyParser.raw({ type: 'application/json' }), webhookHandler);

// JSON for everything else
app.use(bodyParser.json({ limit: '10mb' }));

// Static files (dashboard)
app.use(express.static('public'));

// Health
app.get('/health', (req, res) => {
  const totalEntries = Array.from(tenants.values()).reduce((sum, t) => sum + t.cache.size, 0);
  res.json({
    status: 'ok',
    tenants: tenants.size,
    total_entries: totalEntries,
    uptime: process.uptime(),
  });
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/billing', billingRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/mcp', cacheRouter);

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [, tenant] of tenants) {
    for (const [key, entry] of tenant.cache) {
      if (now > entry.expires_at) tenant.cache.delete(key);
    }
  }
}, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`claude-team-cloud running on port ${PORT}`);
});
