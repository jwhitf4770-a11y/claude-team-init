#!/usr/bin/env node

import { resolve } from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { auditCodebase } from '../src/auditors/codebase.mjs';
import { generateAgents } from '../src/generators/agents.mjs';
import { generateCachehook } from '../src/generators/cachehook.mjs';
import { generateLauncher } from '../src/generators/launcher.mjs';
import { generateClaudeMd } from '../src/generators/claudemd.mjs';
import { generateSettings } from '../src/generators/settings.mjs';
import { generateHooks } from '../src/generators/hooks.mjs';
import { deployFlyio } from '../src/deployers/flyio.mjs';
import { checkLicense, printLicensePrompt } from '../src/license.mjs';

import { readFile as readFileSync } from 'fs/promises';
import { dirname as dirnamePkg } from 'path';
import { fileURLToPath as fileURLToPathPkg } from 'url';

const __dirnameCli = dirnamePkg(fileURLToPathPkg(import.meta.url));
const pkgJson = JSON.parse(await readFileSync(resolve(__dirnameCli, '..', 'package.json'), 'utf-8'));
const VERSION = pkgJson.version;

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(VERSION);
    process.exit(0);
  }

  const yesAll = args.includes('--yes') || args.includes('-y');
  let skipCache = args.includes('--no-cache');
  const skipAudit = args.includes('--no-audit');
  const dryRun = args.includes('--dry-run');
  // Filter out flags and their values (e.g. --key XXXX)
  const flagsWithValues = ['--key'];
  const positionalArgs = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('-')) {
      if (flagsWithValues.includes(args[i])) i++; // skip the next arg too
      continue;
    }
    positionalArgs.push(args[i]);
  }
  const projectDir = resolve(positionalArgs[0] || '.');

  console.log('');
  console.log(chalk.bold.cyan('  CodeCrew'));
  console.log(chalk.gray('  Senior engineering team for your AI-generated code'));
  console.log('');

  // License check
  const license = await checkLicense(args);

  if (!license.valid && !dryRun) {
    console.log(chalk.yellow('  No license key found.'));
    console.log('');
    printLicensePrompt();
    process.exit(0);
  }

  if (license.valid) {
    if (license.offline) {
      console.log(chalk.yellow(`  License: ${license.plan} plan (offline — ${license.offlineDaysLeft} days until re-validation required)`));
    } else {
      console.log(chalk.gray(`  License: ${license.plan} plan`));
    }
    console.log('');
  }

  // Step 1: Audit
  const spinner = ora('Scanning your codebase...').start();
  let audit;
  try {
    audit = await auditCodebase(projectDir);
    spinner.succeed(`Found: ${chalk.bold(audit.framework || audit.language || 'unknown')} project`);
  } catch (err) {
    spinner.fail('Could not scan codebase');
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  // Show what was detected
  console.log('');
  console.log(chalk.bold('  Detected:'));
  if (audit.language)    console.log(`    Language:     ${chalk.green(audit.language)}`);
  if (audit.framework)   console.log(`    Framework:    ${chalk.green(audit.framework)}`);
  if (audit.buildCmd)    console.log(`    Build:        ${chalk.green(audit.buildCmd)}`);
  if (audit.testCmd)     console.log(`    Tests:        ${chalk.green(audit.testCmd)}`);
  if (audit.packageMgr)  console.log(`    Package mgr:  ${chalk.green(audit.packageMgr)}`);
  if (audit.database)    console.log(`    Database:     ${chalk.green(audit.database)}`);
  if (audit.auth)        console.log(`    Auth:         ${chalk.green(audit.auth)}`);
  if (audit.payments)    console.log(`    Payments:     ${chalk.green(audit.payments)}`);
  if (audit.storage)     console.log(`    Storage:      ${chalk.green(audit.storage)}`);
  if (audit.hasApi)      console.log(`    API routes:   ${chalk.green('yes')}`);
  if (audit.hasMobile)   console.log(`    Mobile:       ${chalk.green('yes')}`);
  console.log('');

  // Step 2: Show agent plan
  const agentPlan = buildAgentPlan(audit);

  console.log(chalk.bold('  Agents to generate:'));
  for (const agent of agentPlan) {
    const tier = agent.model === 'opus' ? chalk.magenta(agent.model) :
                 agent.model === 'sonnet' ? chalk.blue(agent.model) :
                 chalk.yellow(agent.model);
    console.log(`    ${chalk.white(agent.name.padEnd(25))} ${tier}  ${chalk.gray(agent.reason)}`);
  }
  console.log('');

  if (dryRun) {
    console.log(chalk.yellow('  Dry run — no files written.'));
    console.log('');
    console.log(chalk.bold('  Files that would be created:'));
    for (const agent of agentPlan) {
      console.log(`    ${chalk.gray(`.claude/agents/${agent.name}.md`)}`);
    }
    console.log(`    ${chalk.gray('.claude/settings.local.json')}`);
    console.log(`    ${chalk.gray('.claude/rules.json')}`);
    console.log(`    ${chalk.gray('scripts/team-launch.sh')}`);
    if (!skipCache) console.log(`    ${chalk.gray('scripts/cache-hook.sh')}`);
    console.log(`    ${chalk.gray('CLAUDE.md')}`);
    console.log('');
    process.exit(0);
  }

  // Confirm (skip with --yes)
  if (!yesAll) {
    const { proceed } = await inquirer.prompt([{
      type: 'confirm',
      name: 'proceed',
      message: 'Generate these agents?',
      default: true
    }]);
    if (!proceed) {
      console.log(chalk.yellow('Aborted.'));
      process.exit(0);
    }
  }

  // Step 3: Fly.io cache
  let cacheConfig = null;
  if (!skipCache && license.features?.cache === false) {
    console.log(chalk.gray('  Cache requires Pro or Team plan. Upgrade at https://codecrew-mu.vercel.app'));
    console.log('');
    skipCache = true;
  }
  if (!skipCache) {
    if (!yesAll) {
      const { setupCache } = await inquirer.prompt([{
        type: 'confirm',
        name: 'setupCache',
        message: 'Set up Fly.io cache server? ($3/month — saves $20-40/day on heavy usage)',
        default: true
      }]);
      if (setupCache) {
        cacheConfig = await deployFlyio(projectDir, audit);
      }
    } else {
      cacheConfig = await deployFlyio(projectDir, audit, { yesAll });
    }
  } else {
    console.log(chalk.gray('  Skipping Fly.io cache (--no-cache)'));
  }

  // Step 4: Generate everything
  console.log('');
  const genSpinner = ora('Generating agent team...').start();

  try {
    await generateAgents(projectDir, agentPlan, audit, cacheConfig);
    genSpinner.text = 'Generating cache hook...';
    await generateCachehook(projectDir, cacheConfig);
    genSpinner.text = 'Generating team launcher...';
    await generateLauncher(projectDir, audit, cacheConfig);
    genSpinner.text = 'Generating CLAUDE.md...';
    await generateClaudeMd(projectDir, audit, agentPlan, cacheConfig);
    genSpinner.text = 'Generating settings...';
    await generateSettings(projectDir, audit);
    genSpinner.text = 'Configuring agent hooks...';
    await generateHooks(projectDir, audit, agentPlan, cacheConfig);
    genSpinner.succeed('Agent team generated!');
  } catch (err) {
    genSpinner.fail('Generation failed');
    console.error(chalk.red(err.message));
    process.exit(1);
  }

  // Step 5: Summary
  console.log('');
  console.log(chalk.bold.green('  Setup complete!'));
  console.log('');
  console.log(chalk.bold('  What happens now:'));
  console.log(chalk.green('    ✔ Agents guard you automatically on every edit and commit'));
  console.log(chalk.green(`    ✔ ${agentPlan.length} agents configured for your stack`));
  if (cacheConfig) {
    console.log(chalk.green(`    ✔ Cache server live: ${cacheConfig.url}`));
  }
  console.log('');
  console.log(chalk.bold('  Commands (inside Claude Code):'));
  console.log(`    ${chalk.cyan('/vibe-audit')}     Code feels messy? Finds + fixes issues to 95%`);
  console.log(`    ${chalk.cyan('/vibe-launch')}    Hard problem? 3 solutions, picks the best`);
  console.log(`    ${chalk.cyan('/vibe-crew')}      Show all commands + workflow guide`);
  console.log('');

  // Step 6: Run audit (skip with --no-audit)
  let runAudit = !skipAudit;
  if (!yesAll && !skipAudit) {
    const answer = await inquirer.prompt([{
      type: 'confirm',
      name: 'runAudit',
      message: 'Run team audit now? (finds problems + fixes them)',
      default: true
    }]);
    runAudit = answer.runAudit;
  }

  if (runAudit) {
    console.log('');
    console.log(chalk.bold.cyan('  Launching team audit...'));
    console.log(chalk.gray('  Scanning for dead code, security holes, bad patterns — then fixing them.'));
    console.log('');

    try {
      const child = spawn('claude', ['--agent', 'team-audit', '-p',
        'Run a full team audit of this codebase. Find every issue — dead code, duplication, security holes, bad patterns, missing essentials. Fix everything to 95% confidence. Write TEAM-AUDIT-REPORT.md.'],
        { cwd: projectDir, stdio: 'inherit' });

      await new Promise((res, rej) => {
        child.on('close', (code) => {
          if (code === 0) res();
          else rej(new Error(`team-audit exited with code ${code}`));
        });
        child.on('error', rej);
      });

      console.log('');
      console.log(chalk.bold.green('  Audit complete! See TEAM-AUDIT-REPORT.md'));
    } catch (err) {
      console.log('');
      console.log(chalk.yellow(`  Audit skipped: ${err.message}`));
      console.log(chalk.gray('  Run it later: /team-audit'));
    }
  }

  console.log('');
}

function buildAgentPlan(audit) {
  const agents = [
    { name: 'build-gate', model: 'haiku', reason: 'Build + lint verification' },
    { name: 'qa-signoff', model: 'haiku', reason: 'Final QA with physical proof' },
    { name: 'regression-checker', model: 'haiku', reason: 'Side effect detection' },
    { name: 'orchestrator', model: 'opus', reason: '3-solution finder with confidence scoring' },
    { name: 'team-audit', model: 'opus', reason: 'Full code audit + auto-fix to 95% confidence' },
    { name: 'team-review', model: 'opus', reason: 'Fast agent team fitness evaluation' },
  ];

  if (audit.testCmd) {
    agents.push({ name: 'test-writer', model: 'haiku', reason: `Test generation (${audit.testRunner || 'detected'})` });
  }
  if (audit.hasApi) {
    agents.push({ name: 'api-prober', model: 'haiku', reason: 'API endpoint testing' });
  }
  if (audit.auth) {
    agents.push({ name: 'auth-verifier', model: 'sonnet', reason: `Auth flow validation (${audit.auth})` });
  }
  if (audit.payments) {
    agents.push({ name: 'billing-bot', model: 'sonnet', reason: `Payment integration (${audit.payments})` });
  }
  if (audit.storage) {
    agents.push({ name: 'upload-bot', model: 'sonnet', reason: `Storage/upload validation (${audit.storage})` });
  }
  if (audit.database) {
    agents.push({ name: 'security-reviewer', model: 'sonnet', reason: `DB security audit (${audit.database})` });
  }
  if (audit.hasMobile) {
    agents.push({ name: 'mobile-expert', model: 'sonnet', reason: 'Mobile compatibility check' });
  }
  if (audit.hasCrypto) {
    agents.push({ name: 'crypto-auditor', model: 'sonnet', reason: 'Encryption integrity audit' });
  }

  return agents;
}

function printHelp() {
  console.log(`
${chalk.bold('CodeCrew')} — Senior engineering team for your AI-generated code

${chalk.bold('Usage:')}
  codecrew                     Set up in current directory
  codecrew ~/my-project        Set up in another directory
  codecrew -y                  Accept all defaults (fewest keystrokes)
  codecrew -y --no-cache       Skip Fly.io, just generate agents

${chalk.bold('Options:')}
  -y, --yes       Accept all defaults — no prompts
  -h, --help      Show this help
  -v, --version   Show version
  --no-cache      Skip Fly.io cache setup
  --no-audit      Skip initial code audit
  --dry-run       Preview without writing files

${chalk.bold('After setup, inside Claude Code:')}
  /vibe-audit     Audit + fix your entire codebase
  /vibe-review    Quick agent team fitness check
  /vibe-launch    Parallel orchestrator mode
  /vibe-init      Re-run setup
  /vibe-crew      Show all commands

${chalk.bold('Learn more:')} https://github.com/jwhitf4770-a11y/claude-team-init
`);
}

main().catch(err => {
  console.error(chalk.red(err.message));
  process.exit(1);
});
