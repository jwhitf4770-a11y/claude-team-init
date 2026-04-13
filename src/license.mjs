import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const LICENSE_DIR = join(homedir(), '.vibe-crew');
const LICENSE_FILE = join(LICENSE_DIR, 'license');
const VALIDATE_URL = 'https://codecrew-mu.vercel.app/api/validate';

export async function loadLicense() {
  try {
    const content = await readFile(LICENSE_FILE, 'utf-8');
    return content.trim();
  } catch {
    return null;
  }
}

export async function saveLicense(key) {
  await mkdir(LICENSE_DIR, { recursive: true });
  await writeFile(LICENSE_FILE, key.trim());
}

export async function validateLicense(key) {
  try {
    const res = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key }),
    });

    if (!res.ok) {
      return { valid: false, error: 'Could not reach license server' };
    }

    return await res.json();
  } catch {
    // Offline — allow cached license to work
    return { valid: true, plan: 'offline', features: { agents: true, cache: true, team: false } };
  }
}

export async function checkLicense(args) {
  // Handle --key flag
  const keyIndex = args.indexOf('--key');
  if (keyIndex !== -1 && args[keyIndex + 1]) {
    const key = args[keyIndex + 1];
    console.log('');
    const result = await validateLicense(key);

    if (result.valid) {
      await saveLicense(key);
      console.log(chalk.green(`  ✔ License activated: ${result.plan} plan`));
      if (result.email) {
        console.log(chalk.gray(`    ${result.email}`));
      }
      console.log('');
      return { valid: true, plan: result.plan, features: result.features };
    } else {
      console.log(chalk.red(`  ✘ Invalid license key: ${result.error}`));
      console.log('');
      process.exit(1);
    }
  }

  // Check saved license
  const savedKey = await loadLicense();
  if (savedKey) {
    const result = await validateLicense(savedKey);
    if (result.valid) {
      return { valid: true, plan: result.plan, features: result.features };
    } else {
      console.log('');
      console.log(chalk.yellow(`  ⚠ License no longer valid: ${result.error}`));
      console.log(chalk.bold('  Renew at https://codecrew-mu.vercel.app'));
      console.log('');
    }
  }

  // No license — dry-run only
  return { valid: false, plan: 'free', features: { agents: false, cache: false, team: false } };
}

export function printLicensePrompt() {
  console.log(chalk.bold('  ⚡ Get your license key:'));
  console.log(chalk.cyan('    https://codecrew-mu.vercel.app'));
  console.log('');
  console.log(chalk.gray('  Then activate:'));
  console.log(chalk.cyan('    npx vibe-crew --key XXXX-XXXX-XXXX-XXXX'));
  console.log('');
  console.log(chalk.gray('  Or preview what we\'d generate:'));
  console.log(chalk.cyan('    npx vibe-crew --dry-run'));
  console.log('');
}
