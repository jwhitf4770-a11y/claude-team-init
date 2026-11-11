import { mkdir, writeFile, readFile, chmod } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), 'cache-hook.sh');

// Source extensions per detected language. The Stop hook only builds when these change.
const SRC_EXT = {
  'JavaScript/TypeScript': 'ts|tsx|js|jsx|mjs|cjs|mts|cts|vue|svelte|astro',
  Python: 'py',
  Ruby: 'rb|erb|rake',
  Go: 'go',
  Rust: 'rs',
  'Java/Kotlin': 'java|kt|kts',
  Java: 'java',
  Dart: 'dart',
  Swift: 'swift',
  Elixir: 'ex|exs|heex',
  PHP: 'php',
};
const ALL_EXT = [...new Set(Object.values(SRC_EXT).join('|').split('|'))].join('|');

const shq = s => `'${String(s ?? '').replace(/'/g, `'\\''`)}'`;

// Always generated: the local digest cache works without Fly. The remote URL/token,
// when configured, live in the gitignored .claude/.cache-env, never in the script.
export async function generateCachehook(projectDir, audit, cacheConfig) {
  const scriptsDir = join(projectDir, 'scripts');
  await mkdir(scriptsDir, { recursive: true });

  const script = (await readFile(TEMPLATE, 'utf-8'))
    .replace('__BUILD_CMD__', () => shq(audit.buildCmd)) // fn form: no `$&`-style expansion
    .replace('__TEST_CMD__', () => shq(audit.testCmd))
    .replace('__SRC_EXT__', () => shq(SRC_EXT[audit.language] || ALL_EXT));
  const hookPath = join(scriptsDir, 'cache-hook.sh');
  await writeFile(hookPath, script);
  await chmod(hookPath, 0o755);

  if (!cacheConfig) return;
  const envPath = join(projectDir, '.claude', '.cache-env');
  await mkdir(join(projectDir, '.claude'), { recursive: true });
  await writeFile(envPath, `FLYIO_URL="${cacheConfig.url}"\nFLYIO_TOKEN="${cacheConfig.token}"\n`);
  await chmod(envPath, 0o600);
  await ensureGitignore(projectDir, ['.claude/.cache-env', '.agent-cache-server/']);
}

// Append missing lines to .gitignore (idempotent).
export async function ensureGitignore(projectDir, lines) {
  const p = join(projectDir, '.gitignore');
  let cur = '';
  try { cur = await readFile(p, 'utf-8'); } catch {}
  const have = new Set(cur.split('\n').map(l => l.trim()));
  const add = lines.filter(l => !have.has(l));
  if (add.length === 0) return;
  await writeFile(p, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + add.join('\n') + '\n');
}
