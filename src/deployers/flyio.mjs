import { execSync } from 'child_process';
import { writeFile, mkdir, readFile, cp } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { randomBytes } from 'crypto';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

// ONE server source: the self-hosted cache is a copy of cloud/ (MCP_TOKEN = single-tenant mode).
const CLOUD_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'cloud');

export async function writeCacheServer(serverDir, appName) {
  await mkdir(serverDir, { recursive: true });
  for (const f of ['src', 'public', 'package.json', 'Dockerfile']) {
    await cp(join(CLOUD_DIR, f), join(serverDir, f), { recursive: true });
  }
  const flyToml = await readFile(join(CLOUD_DIR, 'fly.toml'), 'utf-8');
  await writeFile(join(serverDir, 'fly.toml'), flyToml.replace(/^app = .*$/m, `app = "${appName}"`));
}

export async function deployFlyio(projectDir, audit, { yesAll = false } = {}) {
  const projectName = projectDir.split('/').pop().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const appName = `${projectName}-agent-cache`;
  const token = randomBytes(24).toString('hex');

  console.log('');
  console.log(chalk.bold('  Fly.io Cache Server Setup'));
  console.log(chalk.gray('  A tiny Express server (cloud/, single-tenant) that caches build/test digests'));
  console.log(chalk.gray('  so your agents don\'t repeat each other\'s work.'));
  console.log(chalk.gray('  Cost: ~$3/month (shared-cpu-1x, 256MB, 1GB volume)'));
  console.log('');

  // Check if flyctl is installed
  try {
    execSync('flyctl version', { stdio: 'pipe' });
  } catch {
    if (yesAll) {
      console.log('');
      console.log(chalk.yellow('  ⚠ flyctl not found — cache server requires Fly.io CLI.'));
      console.log('');
      console.log(chalk.bold('  Option 1: Install Fly.io and get the cache (recommended)'));
      console.log(chalk.cyan('    brew install flyctl'));
      console.log(chalk.cyan('    fly auth login'));
      console.log(chalk.cyan('    npx vibe-crew -y'));
      console.log('');
      console.log(chalk.bold('  Option 2: Skip the cache'));
      console.log(chalk.cyan('    npx vibe-crew -y --no-cache'));
      console.log('');
      console.log(chalk.gray('  Without the cache (~$3/mo), agents repeat each other\'s work.'));
      console.log(chalk.gray('  Typical waste: $15-40/day in duplicate API calls.'));
      console.log('');
      process.exit(1);
    }
    console.log(chalk.yellow('  flyctl not installed. Install it first:'));
    console.log('');
    console.log(chalk.cyan('    brew install flyctl'));
    console.log(chalk.cyan('    fly auth login'));
    console.log('');

    const { installed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'installed',
      message: 'Have you installed flyctl and logged in?',
      default: false,
    }]);

    if (!installed) {
      console.log(chalk.yellow('  Skipping Fly.io setup. You can run this again later.'));
      return null;
    }
  }

  // Check if logged in
  try {
    execSync('flyctl auth whoami', { stdio: 'pipe' });
  } catch {
    if (yesAll) {
      console.log('');
      console.log(chalk.yellow('  ⚠ Not logged in to Fly.io.'));
      console.log('');
      console.log(chalk.bold('  Option 1: Log in and get the cache (recommended)'));
      console.log(chalk.cyan('    fly auth login'));
      console.log(chalk.cyan('    npx vibe-crew -y'));
      console.log('');
      console.log(chalk.bold('  Option 2: Skip the cache'));
      console.log(chalk.cyan('    npx vibe-crew -y --no-cache'));
      console.log('');
      console.log(chalk.gray('  Without the cache (~$3/mo), agents repeat each other\'s work.'));
      console.log(chalk.gray('  Typical waste: $15-40/day in duplicate API calls.'));
      console.log('');
      process.exit(1);
    }
    console.log(chalk.yellow('  Not logged in to Fly.io. Run:'));
    console.log(chalk.cyan('    fly auth login'));

    const { loggedIn } = await inquirer.prompt([{
      type: 'confirm',
      name: 'loggedIn',
      message: 'Have you logged in?',
      default: false,
    }]);

    if (!loggedIn) {
      console.log(chalk.yellow('  Skipping Fly.io setup.'));
      return null;
    }
  }

  // Generate the cache server
  const serverDir = join(projectDir, '.agent-cache-server');
  const spinner = ora('Generating cache server...').start();

  try {
    await writeCacheServer(serverDir, appName);
    spinner.succeed('Cache server generated');
  } catch (err) {
    spinner.fail('Failed to generate cache server');
    console.error(chalk.red(err.message));
    return null;
  }

  // Deploy
  let deploy = true;
  if (!yesAll) {
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'deploy',
      message: `Deploy cache server as "${appName}" on Fly.io?`,
      default: true,
    }]);
    deploy = answer.deploy;
  }

  if (!deploy) {
    console.log(chalk.gray(`  Server files saved to ${serverDir}`));
    console.log(chalk.gray('  Deploy manually: cd .agent-cache-server && fly launch --no-deploy && fly volumes create cache_data --size 1 --region ord --yes && fly secrets set MCP_TOKEN=<token in .claude/.cache-env> && fly deploy --ha=false'));
    return { url: `https://${appName}.fly.dev`, token, serverDir, deployed: false };
  }

  const deploySpinner = ora('Deploying to Fly.io...').start();

  try {
    execSync(`cd "${serverDir}" && flyctl launch --name ${appName} --region ord --no-deploy --yes`, {
      stdio: 'pipe',
    });

    // token lives in a Fly secret, not in the generated server files
    execSync(`cd "${serverDir}" && flyctl secrets set MCP_TOKEN=${token} --stage`, { stdio: 'pipe' });

    // the store lives on this volume so auto-stopped machines keep their cache
    // (create only if missing: `volumes create` happily makes a second, billed, same-named volume)
    const vols = execSync(`cd "${serverDir}" && flyctl volumes list --json`, { stdio: 'pipe' }).toString();
    if (!vols.includes('"cache_data"')) {
      execSync(`cd "${serverDir}" && flyctl volumes create cache_data --size 1 --region ord --yes`, { stdio: 'pipe' });
    }

    execSync(`cd "${serverDir}" && flyctl deploy --ha=false`, {
      stdio: 'pipe',
      timeout: 120000,
    });

    deploySpinner.succeed(`Deployed: ${chalk.cyan(`https://${appName}.fly.dev`)}`);
  } catch (err) {
    deploySpinner.fail('Deploy failed');
    console.error(chalk.red('  Try manually: cd .agent-cache-server && fly launch'));
    return { url: `https://${appName}.fly.dev`, token, serverDir, deployed: false };
  }

  // Health check
  const healthSpinner = ora('Checking health...').start();
  try {
    await new Promise(resolve => setTimeout(resolve, 5000));
    execSync(`curl -sf https://${appName}.fly.dev/health`, { stdio: 'pipe', timeout: 10000 });
    healthSpinner.succeed('Cache server healthy');
  } catch {
    healthSpinner.warn('Health check failed — server may still be starting up');
  }

  const config = {
    url: `https://${appName}.fly.dev`,
    token,
    serverDir,
    deployed: true,
  };

  console.log('');
  console.log(chalk.gray(`  URL:   ${config.url}`));
  console.log(chalk.gray(`  Token: ${token.slice(0, 8)}...`));
  console.log('');

  return config;
}
