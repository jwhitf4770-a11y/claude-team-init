import { readFile, writeFile, mkdir, stat } from 'fs/promises';
import { join } from 'path';
import { homedir } from 'os';
import chalk from 'chalk';

const LICENSE_DIR = join(homedir(), '.vibe-crew');
const LICENSE_FILE = join(LICENSE_DIR, 'license');
const VALIDATED_FILE = join(LICENSE_DIR, 'last-validated');
const VALIDATE_URL = 'https://codecrew-mu.vercel.app/api/validate';

// Offline grace period: 7 days from last successful validation
const OFFLINE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

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

async function saveValidation(plan, features) {
  await mkdir(LICENSE_DIR, { recursive: true });
  await writeFile(VALIDATED_FILE, JSON.stringify({
    at: Date.now(),
    plan,
    features,
  }));
}

async function loadLastValidation() {
  try {
    const content = await readFile(VALIDATED_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
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

    const result = await res.json();

    // Cache successful validations for offline grace period
    if (result.valid) {
      await saveValidation(result.plan, result.features);
    }

    return result;
  } catch {
    // Offline — check if within grace period
    const last = await loadLastValidation();
    if (last && (Date.now() - last.at) < OFFLINE_GRACE_MS) {
      const daysLeft = Math.ceil((OFFLINE_GRACE_MS - (Date.now() - last.at)) / (24 * 60 * 60 * 1000));
      return {
        valid: true,
        plan: last.plan,
        features: last.features,
        offline: true,
        offlineDaysLeft: daysLeft,
      };
    }

    return { valid: false, error: 'Offline too long — connect to the internet to re-validate your license' };
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
