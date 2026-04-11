import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function generateClaudeMd(projectDir, audit, agentPlan, cacheConfig) {
  const claudeMdPath = join(projectDir, 'CLAUDE.md');

  // Check if CLAUDE.md already exists
  let existing = '';
  try {
    existing = await readFile(claudeMdPath, 'utf-8');
  } catch {
    // File doesn't exist, that's fine
  }

  if (existing && existing.includes('## Agent Team')) {
    // Already has agent config, don't overwrite
    return;
  }

  const content = existing
    ? existing + '\n\n' + generateAgentSection(audit, agentPlan, cacheConfig)
    : generateFullClaudeMd(audit, agentPlan, cacheConfig);

  await writeFile(claudeMdPath, content);
}

function generateFullClaudeMd(audit, agentPlan, cacheConfig) {
  return `# Claude Code Rules

## Permissions & Autonomy

\`\`\`
AUTONOMOUS EXECUTION MODE:
- All tools are pre-approved
- Questions allowed ONLY at the start, BEFORE any code changes
- Once execution begins: NEVER stop, ask, confirm, or wait for input
- Make your own decisions mid-task. Pick the safest option. Keep going.
\`\`\`

## Core Principles

1. **Don't Break Working Code** — Only change if asked, bug exists, or security vuln.
2. **No Unnecessary Refactoring** — Only if requested, bug fix, security, or build errors.
3. **Use Existing Patterns** — Check existing code before writing new.
4. **Code is the Source of Truth** — Read before modify. Run \`${audit.buildCmd || 'build'}\` if unsure.

---

${generateAgentSection(audit, agentPlan, cacheConfig)}

---

## Workflow

- **Bug fixes:** Read code → minimal fix → physical proof → build-gate → qa-signoff
- **New features:** Check existing patterns → implement → build-gate → qa-signoff

## Commits

\`\`\`
feat|fix|perf|chore|docs: [description]
\`\`\`
`;
}

function generateAgentSection(audit, agentPlan, cacheConfig) {
  const haiku = agentPlan.filter(a => a.model === 'haiku');
  const sonnet = agentPlan.filter(a => a.model === 'sonnet');
  const opus = agentPlan.filter(a => a.model === 'opus');

  let section = `## Agent Team

| Tier | Agent | Purpose |
|------|-------|---------|
`;

  for (const a of haiku)  section += `| Haiku | \`${a.name}\` | ${a.reason} |\n`;
  for (const a of sonnet) section += `| Sonnet | \`${a.name}\` | ${a.reason} |\n`;
  for (const a of opus)   section += `| Opus | \`${a.name}\` | ${a.reason} |\n`;

  section += `
**Workflow:**
1. Code change → \`build-gate\` (validates build)
`;

  if (agentPlan.find(a => a.name === 'api-prober'))
    section += `2. If API changed → \`api-prober\` (curls endpoints)\n`;

  if (agentPlan.find(a => a.name === 'regression-checker'))
    section += `3. If shared code changed → \`regression-checker\` (runs test suite)\n`;

  section += `4. \`qa-signoff\` (final approval with physical proof)
5. Hand to user ONLY after qa-signoff APPROVED

**3-Strike Rule:** If same fix fails 3 times, escalate to orchestrator (Opus).
`;

  if (cacheConfig) {
    section += `
${generateOrchestratorSection()}`;
  }

  return section;
}

function generateOrchestratorSection() {
  return `
## Orchestrator Pattern (Team Launch)

For complex problems, use the orchestrator:

**Launch:** \`./scripts/team-launch.sh "problem 1" "problem 2"\`
**Cleanup:** \`./scripts/team-launch.sh --cleanup\`

Each orchestrator:
1. Generates **3 distinct solution candidates**
2. Validates each through **build-gate + regression-checker + qa-signoff**
3. Scores confidence: build (30) + regression (30) + qa (25) + judgment (15)
4. Iterates until **97% confidence** or **5 rounds** (92% acceptable after round 5)
5. Leaves winning branch local for review — never pushes

### Confidence Thresholds
- **97%+** → ACCEPTED
- **92-96% after 5 rounds** → ACCEPTED_WITH_CAVEAT
- **<92% after 5 rounds** → FAILED

### Cache Keys (namespaced per session)
- \`orch-{SID}-candidate-{N}\` — candidate plan
- \`orch-{SID}-scores\` — per-round scoring
- \`orch-{SID}-result\` — final result
- \`{SID}-build-output\` — namespaced build result
`;
}
