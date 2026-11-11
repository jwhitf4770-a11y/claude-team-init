import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

export async function generateSettings(projectDir, audit) {
  const claudeDir = join(projectDir, '.claude');
  await mkdir(claudeDir, { recursive: true });

  const settingsPath = join(claudeDir, 'settings.local.json');

  // Don't overwrite existing settings
  try {
    await readFile(settingsPath);
    return; // Already exists
  } catch {
    // Doesn't exist, create it
  }

  const deny = [
    'Bash(git push*--force*)',
    'Bash(git push*-f *)',
    'Bash(git reset --hard*)',
    'Bash(*git commit*--no-verify*)',
    'Bash(*git push*--no-verify*)',
  ];

  const settings = {
    permissions: {
      allow: [
        'Bash(*)',
        'Read(*)',
        'Write(*)',
        'Edit(*)',
        'Glob(*)',
        'Grep(*)',
        'Skill(*)',
      ],
      deny,
    },
  };

  await writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n');
}
