import { getTenantByApiKey } from './store.mjs';

/**
 * Auth middleware — resolves tenant from Bearer token.
 * Shared across all authenticated routes.
 */
export function auth(req, res, next) {
  const bearer = req.headers.authorization?.replace('Bearer ', '');
  if (!bearer) return res.status(401).json({ error: 'unauthorized' });

  const tenant = getTenantByApiKey(bearer);
  if (!tenant) return res.status(401).json({ error: 'invalid api key' });

  req.tenant = tenant;
  next();
}
