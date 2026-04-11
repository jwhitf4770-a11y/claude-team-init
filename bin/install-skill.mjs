#!/usr/bin/env node

import { mkdir, copyFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function install() {
  const skillSrcDir = join(__dirname, '..', 'skill');
  const skillDestDir = join(homedir(), '.claude', 'skills');

  let files;
  try {
    files = await readdir(skillSrcDir);
  } catch {
    return; // no skill directory, skip silently
  }

  const skills = files.filter(f => f.endsWith('.md'));
  if (skills.length === 0) return;

  try {
    await mkdir(skillDestDir, { recursive: true });
    for (const skill of skills) {
      await copyFile(join(skillSrcDir, skill), join(skillDestDir, skill));
    }
    const names = skills.map(s => '/' + s.replace('.md', '')).join(', ');
    console.log(`  \u2714 Installed Claude Code skills: ${names}`);
  } catch {
    // Non-fatal — user can copy manually
  }
}

install();
