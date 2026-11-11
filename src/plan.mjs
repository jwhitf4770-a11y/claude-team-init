// Which agents to generate for a detected stack. opts: { infra, rateLimit } force the opt-in agents.
export function buildAgentPlan(audit, opts = {}) {
  const agents = [
    { name: 'build-gate', model: 'haiku', reason: 'Build digest + security diff audit' },
    { name: 'qa-signoff', model: 'sonnet', reason: 'Final QA with physical proof, once at handoff' },
    { name: 'regression-checker', model: 'haiku', reason: 'Side effect detection' },
    { name: 'orchestrator', model: 'opus', reason: 'Candidate fixes, lowest blast radius first, stops at the first pass' },
    { name: 'team-audit', model: 'opus', reason: 'Full code audit + auto-fix to 95% confidence' },
    { name: 'team-review', model: 'sonnet', reason: 'Fast agent team fitness evaluation' },
  ];

  if (audit.testCmd) {
    agents.push({ name: 'test-writer', model: 'sonnet', reason: `Test generation (${audit.testRunner || 'detected'})` });
  }
  if (audit.hasApi) {
    agents.push({ name: 'api-prober', model: 'haiku', reason: 'API endpoint testing' });
  }
  // One security agent with a section per detected surface (was auth-verifier,
  // billing-bot, upload-bot, crypto-auditor + security-reviewer).
  const surfaces = [audit.database, audit.auth, audit.payments, audit.storage, audit.hasCrypto && 'crypto'].filter(Boolean);
  if (surfaces.length) {
    agents.push({ name: 'security-reviewer', model: 'sonnet', reason: `Security review (${surfaces.join(', ')})` });
  }
  if (audit.hasMobile) {
    agents.push({ name: 'mobile-expert', model: 'sonnet', reason: 'Mobile compatibility check' });
  }

  agents.push({ name: 'security-patcher', model: 'haiku', reason: 'Dependency audit auto-fix at 97% confidence' });

  // Opt-in: only when the infra/rate-limit code exists or the flag asks for it.
  if (opts.infra || audit.infra?.length) {
    agents.push({ name: 'infra-auditor', model: 'haiku', reason: `Infra waste detection (${audit.infra?.join(', ') || 'flag'})` });
  }
  if (opts.rateLimit || audit.rateLimit) {
    agents.push({ name: 'rate-limit-specialist', model: 'sonnet', reason: `Rate limit backend selection (${audit.rateLimit || 'flag'})` });
  }

  return agents;
}
