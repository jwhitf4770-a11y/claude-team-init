import { Router } from 'express';
import { auth } from '../middleware.mjs';

export const router = Router();

// Dashboard data — single endpoint for the frontend
router.get('/data', auth, (req, res) => {
  const tenant = req.tenant;
  const now = Date.now();

  // Build entries list with savings calculations
  const entries = [];
  let totalTokensSaved = 0;
  let totalReads = 0;
  let totalWrites = tenant.stats.totalWrites;
  let activeAgents = new Set();

  for (const [key, entry] of tenant.cache) {
    if (now > entry.expires_at) {
      tenant.cache.delete(key);
      continue;
    }

    const tokensSaved = entry.meta.original_bytes
      ? entry.meta.read_count * (entry.meta.original_bytes - entry.meta.value_bytes)
      : 0;

    totalTokensSaved += tokensSaved;
    totalReads += entry.meta.read_count;

    // Track active agents from agent-log keys
    if (key.startsWith('agent-log-')) {
      activeAgents.add(key.replace('agent-log-', ''));
    }

    entries.push({
      key,
      value_bytes: entry.meta.value_bytes,
      original_bytes: entry.meta.original_bytes,
      read_count: entry.meta.read_count,
      tokens_saved: tokensSaved,
      created_at: entry.meta.created_at,
    });
  }

  // Cost estimate: ~$0.01 per 1000 tokens (rough Opus average)
  const costSaved = totalTokensSaved / 100000;

  res.json({
    account: {
      plan: tenant.plan,
      email: tenant.email,
      limits: tenant.limits,
    },
    savings: {
      total_tokens_saved: totalTokensSaved,
      estimated_cost_saved: `$${costSaved.toFixed(2)}`,
      total_reads: totalReads,
      total_writes: totalWrites,
      cache_hit_rate: totalReads + totalWrites > 0
        ? `${((totalReads / (totalReads + totalWrites)) * 100).toFixed(1)}%`
        : '0%',
    },
    agents: {
      active: Array.from(activeAgents),
      count: activeAgents.size,
    },
    cache: {
      entries_count: entries.length,
      max_entries: tenant.limits.maxKeys,
      top_savers: entries
        .sort((a, b) => b.tokens_saved - a.tokens_saved)
        .slice(0, 10),
    },
  });
});
