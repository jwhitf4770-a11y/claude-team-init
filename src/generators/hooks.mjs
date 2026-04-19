import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function generateHooks(projectDir, audit, agentPlan, cacheConfig) {
  const claudeDir = join(projectDir, '.claude');
  await mkdir(claudeDir, { recursive: true });

  const settingsPath = join(claudeDir, 'settings.local.json');

  let settings;
  try {
    settings = JSON.parse(await readFile(settingsPath, 'utf-8'));
  } catch {
    settings = {};
  }

  await generateRules(claudeDir, audit, agentPlan);

  if (!settings.hooks) settings.hooks = {};

  const buildCmd = audit.buildCmd;
  const testCmd = audit.testCmd;
  const hasCache = Boolean(cacheConfig);

  // PostToolUse: after Edit/Write/MultiEdit run build in background, cache the result.
  // Hook commands cannot recursively spawn `claude -p`; they are plain shell.
  if (buildCmd) {
    settings.hooks.PostToolUse = settings.hooks.PostToolUse || [];
    settings.hooks.PostToolUse.push({
      matcher: 'Edit|Write|MultiEdit',
      hooks: [
        {
          type: 'command',
          command: buildPostEditCommand(buildCmd, hasCache),
        },
      ],
    });
  }

  // UserPromptSubmit: inject a short status line (last build + cache health) so the
  // main session sees up-to-date context without an extra tool call.
  if (hasCache || buildCmd) {
    settings.hooks.UserPromptSubmit = settings.hooks.UserPromptSubmit || [];
    settings.hooks.UserPromptSubmit.push({
      hooks: [
        {
          type: 'command',
          command: buildStatusInjection(hasCache),
        },
      ],
    });
  }

  // SessionStart: show the team roster once per session.
  settings.hooks.SessionStart = settings.hooks.SessionStart || [];
  settings.hooks.SessionStart.push({
    matcher: 'startup|resume',
    hooks: [
      {
        type: 'command',
        command: buildSessionStart(agentPlan, hasCache),
      },
    ],
  });

  // Stop: flush a session summary to the cache so the next run has context.
  if (hasCache) {
    settings.hooks.Stop = settings.hooks.Stop || [];
    settings.hooks.Stop.push({
      hooks: [
        {
          type: 'command',
          command: `scripts/cache-hook.sh set "last-session-end" "\\"$(date -u +'%Y-%m-%dT%H:%M:%SZ')\\"" 86400 2>/dev/null || true`,
        },
      ],
    });
  }

  // PreToolUse: refuse destructive git operations even if permissions slip through.
  settings.hooks.PreToolUse = settings.hooks.PreToolUse || [];
  settings.hooks.PreToolUse.push({
    matcher: 'Bash',
    hooks: [
      {
        type: 'command',
        command: destructiveGitGuard(),
      },
    ],
  });

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}

function buildPostEditCommand(buildCmd, hasCache) {
  const cacheWrite = hasCache
    ? `scripts/cache-hook.sh cache-build "$status" "$(tail -c 400 "$logfile")" '[]' 2>/dev/null || true`
    : `:`;

  // `if ... then` and `fi` are structural — must be separated by newlines, not semicolons.
  // `mktemp` without args is portable between BSD (macOS) and GNU (Linux).
  return [
    `logfile=$(mktemp)`,
    `( ${buildCmd} ) >"$logfile" 2>&1 && status=success || status=fail`,
    cacheWrite,
    `if [ "$status" = "fail" ]; then`,
    `  echo "[vibe-crew] build-gate FAIL — see $logfile" >&2`,
    `  exit 2`,
    `fi`,
    `rm -f "$logfile"`,
  ].join('\n');
}

function buildStatusInjection(hasCache) {
  if (!hasCache) {
    return `echo "[vibe-crew] $(date -u +%H:%MZ)"`;
  }
  return [
    `build=$(scripts/cache-hook.sh get build-output 2>/dev/null | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)`,
    `health=$(scripts/cache-hook.sh health 2>/dev/null | head -1)`,
    `echo "[vibe-crew] build:\${build:-unknown} cache:\${health:-offline}"`,
  ].join('; ');
}

function buildSessionStart(agentPlan, hasCache) {
  const roster = agentPlan.map(a => a.name).join(', ');
  const cacheLine = hasCache
    ? ` && scripts/cache-hook.sh health 2>/dev/null || true`
    : '';
  return `echo "[vibe-crew] team: ${roster}"${cacheLine}`;
}

function destructiveGitGuard() {
  // Reads the PreToolUse payload on stdin and blocks obvious destructive git calls.
  // NOTE: `case ... in` and `esac` are structural keywords — must be separated by
  // newlines, not semicolons. A `; ` join here produces a syntax error.
  return [
    `payload=$(cat)`,
    `cmd=$(printf '%s' "$payload" | sed -n 's/.*"command":"\\([^"]*\\)".*/\\1/p')`,
    `case "$cmd" in`,
    `  *"git push"*"--force"*|*"git push"*" -f "*|*"git reset --hard"*|*"git commit"*"--no-verify"*)`,
    `    echo "[vibe-crew] blocked destructive git: $cmd" >&2`,
    `    exit 2`,
    `    ;;`,
    `esac`,
    `exit 0`,
  ].join('\n');
}

async function generateRules(claudeDir, audit, agentPlan) {
  const rulesPath = join(claudeDir, 'rules.json');

  try {
    await readFile(rulesPath);
    return;
  } catch {
    // Doesn't exist, create it
  }

  const agentNames = agentPlan.map(a => a.name);

  const rules = {
    version: 1,
    description: 'Agent trigger rules generated by claude-team-init. Defines when agents auto-activate based on file changes.',
    rules: [],
  };

  const srcExtensions = {
    'JavaScript/TypeScript': '**/*.{ts,tsx,js,jsx,mjs}',
    'Python': '**/*.py',
    'Ruby': '**/*.rb',
    'Go': '**/*.go',
    'Rust': '**/*.rs',
    'Swift': '**/*.swift',
    'Dart': '**/*.dart',
    'Java/Kotlin': '**/*.{java,kt}',
    'PHP': '**/*.php',
    'Elixir': '**/*.{ex,exs}',
  };

  const srcPattern = srcExtensions[audit.language] || '**/*.{ts,tsx,js,jsx}';

  rules.rules.push({
    id: 'auto-build-gate',
    title: 'Build Gate on Source Changes',
    scope: {
      triggersOn: [`Any change to ${srcPattern}`],
      doesNotTriggerOn: ['Comment-only changes', 'Type-only edits', 'README/docs changes'],
    },
    action: {
      agent: 'build-gate',
      blocking: false,
      description: 'Automatically verify the build passes after source code changes',
    },
  });

  if (agentNames.includes('security-reviewer') && audit.database) {
    const dbTriggers = [];
    if (audit.database === 'Supabase') {
      dbTriggers.push('Any change to supabase/**', 'Any change to **/migrations/**');
    }
    if (audit.database === 'Prisma') {
      dbTriggers.push('Any change to prisma/**');
    }
    dbTriggers.push('Any change to **/*auth*', 'Any change to **/*policy*', 'Any change to **/*permission*');

    rules.rules.push({
      id: 'auto-security-review',
      title: `Security Review on ${audit.database} Changes`,
      scope: {
        triggersOn: dbTriggers,
      },
      action: {
        agent: 'security-reviewer',
        blocking: true,
        description: `Auto-trigger security review when ${audit.database} schemas or auth code changes`,
      },
    });
  }

  if (agentNames.includes('mobile-expert') && audit.hasApi) {
    rules.rules.push({
      id: 'auto-mobile-compat',
      title: 'Mobile Compatibility on API Changes',
      scope: {
        triggersOn: [
          'Any change to **/api/**',
          'Any change to **/routes/**',
          'Any change to **/controllers/**',
        ],
      },
      action: {
        agent: 'mobile-expert',
        blocking: false,
        description: 'Check that API changes don\'t break mobile clients',
      },
    });
  }

  if (agentNames.includes('auth-verifier') && audit.auth) {
    rules.rules.push({
      id: 'auto-auth-verify',
      title: `Auth Verification on ${audit.auth} Changes`,
      scope: {
        triggersOn: [
          'Any change to **/*auth*',
          'Any change to **/*session*',
          'Any change to **/*login*',
          'Any change to **/*signup*',
          'Any change to **/middleware*',
        ],
      },
      action: {
        agent: 'auth-verifier',
        blocking: true,
        description: `Auto-verify auth flows when ${audit.auth} code changes`,
      },
    });
  }

  if (agentNames.includes('billing-bot') && audit.payments) {
    rules.rules.push({
      id: 'auto-billing-check',
      title: `Billing Check on ${audit.payments} Changes`,
      scope: {
        triggersOn: [
          'Any change to **/*billing*',
          'Any change to **/*payment*',
          'Any change to **/*subscription*',
          'Any change to **/*webhook*',
          'Any change to **/*stripe*',
          'Any change to **/*checkout*',
        ],
      },
      action: {
        agent: 'billing-bot',
        blocking: true,
        description: `Auto-verify payment logic when ${audit.payments} code changes`,
      },
    });
  }

  if (agentNames.includes('crypto-auditor') && audit.hasCrypto) {
    rules.rules.push({
      id: 'auto-crypto-audit',
      title: 'Crypto Audit on Encryption Changes',
      scope: {
        triggersOn: [
          'Any change to **/*crypto*',
          'Any change to **/*encrypt*',
          'Any change to **/*decrypt*',
          'Any change to **/*cipher*',
          'Any change to **/*key*',
        ],
      },
      action: {
        agent: 'crypto-auditor',
        blocking: true,
        description: 'Auto-audit when encryption code changes',
      },
    });
  }

  rules.rules.push({
    id: 'post-commit-pipeline',
    title: 'Post-Commit Validation Pipeline',
    scope: {
      triggersOn: ['Any git commit'],
    },
    action: {
      pipeline: ['build-gate', 'regression-checker', 'qa-signoff'],
      description: 'Sequential validation after every commit: build → tests → QA signoff',
    },
  });

  await writeFile(rulesPath, JSON.stringify(rules, null, 2) + '\n');
}
