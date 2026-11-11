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

Autonomous mode: ask questions only before work starts; once running, decide and keep going.
Read code before changing it; follow existing patterns; no unrequested refactors.${audit.buildCmd ? `\nBuild: \`${audit.buildCmd}\`` : ''}

${generateAgentSection(audit, agentPlan, cacheConfig)}
Commits: \`feat|fix|perf|chore|docs: description\`
`;
}

function generateAgentSection(audit, agentPlan, cacheConfig) {
  const has = n => agentPlan.some(a => a.name === n);
  const flow = ['build-gate', 'api-prober', 'regression-checker', 'qa-signoff'].filter(has).join(' > ');
  return `## Agent Team

Agents live in \`.claude/agents/\`. After a code change: ${flow}; hand off only after qa-signoff APPROVES.
Same fix fails 3 times: use \`orchestrator\`.${cacheConfig ? '\nShared cache: `scripts/cache-hook.sh` (best-effort, token in `.claude/.cache-env`).' : ''}
`;
}
