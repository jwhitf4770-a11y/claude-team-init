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

  // Stop: the ONE builder. Once per turn, only when uncommitted source files changed,
  // skipped on a cached digest for the same tree, blocks at most once (stop_hook_active).
  // Logic lives in scripts/cache-hook.sh so it can be tested and `bash -n` checked.
  if (audit.buildCmd) {
    settings.hooks.Stop = settings.hooks.Stop || [];
    settings.hooks.Stop.push({
      hooks: [{ type: 'command', command: MARK + '"${CLAUDE_PROJECT_DIR:-.}/scripts/cache-hook.sh" stop-check' }],
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
