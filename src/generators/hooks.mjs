import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const MARK = '# vibe-crew\n';
// Also matches entries written by older versions (they all echoed "[vibe-crew]" or wrote last-session-end).
const isOurs = c => typeof c === 'string' && (c.includes('# vibe-crew') || c.includes('[vibe-crew]') || c.includes('last-session-end'));

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

  if (!settings.hooks) settings.hooks = {};

  // Idempotence: drop anything a previous run generated (identified by MARK), then re-add.
  for (const ev of Object.keys(settings.hooks)) {
    settings.hooks[ev] = (settings.hooks[ev] || []).filter(
      e => !(e.hooks || []).some(x => isOurs(x.command))
    );
    if (settings.hooks[ev].length === 0) delete settings.hooks[ev];
  }

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
          command: MARK + buildPostEditCommand(buildCmd, hasCache),
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
        command: MARK + destructiveGitGuard(),
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
