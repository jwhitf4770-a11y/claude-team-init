#!/usr/bin/env node

import { resolve } from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { auditCodebase } from '../src/auditors/codebase.mjs';
import { generateAgents } from '../src/generators/agents.mjs';
import { generateCachehook } from '../src/generators/cachehook.mjs';
import { generateLauncher } from '../src/generators/launcher.mjs';
import { generateClaudeMd } from '../src/generators/claudemd.mjs';
import { generateSettings } from '../src/generators/settings.mjs';
import { deployFlyio } from '../src/deployers/flyio.mjs';

const VERSION = '0.1.0';

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

  const projectDir = resolve(args[0] || '.');

  console.log('');
  console.log(chalk.bold.cyan('  claude-team-init'));
  console.log(chalk.gray('  AI agent team bootstrapper'));
  console.log('');

  // Step 1: Audit
  const spinner = ora('Scanning your codebase...').start();
  let audit;
  try {
    audit = await auditCodebase(projectDir);
    spinner.succeed(`Found: ${chalk.bold(audit.framework || audit.language)} project`);
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

  // Step 2: Confirm agent plan
  const agentPlan = buildAgentPlan(audit);

  console.log(chalk.bold('  Agents to generate:'));
  for (const agent of agentPlan) {
    const tier = agent.model === 'opus' ? chalk.magenta(agent.model) :
                 agent.model === 'sonnet' ? chalk.blue(agent.model) :
                 chalk.yellow(agent.model);
    console.log(`    ${chalk.white(agent.name.padEnd(25))} ${tier}  ${chalk.gray(agent.reason)}`);
  }
  console.log('');

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

  // Step 3: Fly.io setup
  console.log('');
  const { setupCache } = await inquirer.prompt([{
    type: 'confirm',
    name: 'setupCache',
    message: 'Set up Fly.io cache server? ($3/month — saves $20-40/day on heavy usage)',
    default: true
  }]);

  let cacheConfig = null;
  if (setupCache) {
    cacheConfig = await deployFlyio(projectDir, audit);
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
  console.log(chalk.bold('  Quick start:'));
  console.log(`    ${chalk.cyan('claude --agent build-gate')}         Check your build`);
  console.log(`    ${chalk.cyan('claude --agent qa-signoff')}         Full QA pass`);
  console.log(`    ${chalk.cyan('./scripts/team-launch.sh "fix X"')}  Orchestrator mode`);
  console.log(`    ${chalk.cyan('./scripts/team-launch.sh --monitor')} Watch progress`);
  console.log('');
  console.log(chalk.bold('  Files created:'));
  console.log(`    ${chalk.gray('.claude/agents/')}        ${agentPlan.length} agent definitions`);
  console.log(`    ${chalk.gray('.claude/settings.local.json')}  Permission guardrails`);
  console.log(`    ${chalk.gray('scripts/team-launch.sh')}  Parallel orchestrator launcher`);
  if (cacheConfig) {
    console.log(`    ${chalk.gray('scripts/cache-hook.sh')} Fly.io cache integration`);
  }
  console.log(`    ${chalk.gray('CLAUDE.md')}              Agent workflow rules`);
  console.log('');
  if (cacheConfig) {
    console.log(chalk.gray(`  Cache server: ${cacheConfig.url}`));
    console.log(chalk.gray(`  Estimated savings: $20-40/day on heavy usage`));
  }
  console.log('');
}

function buildAgentPlan(audit) {
  const agents = [
    // Always generated
    { name: 'build-gate', model: 'haiku', reason: 'Build + lint verification' },
    { name: 'qa-signoff', model: 'haiku', reason: 'Final QA with physical proof' },
    { name: 'regression-checker', model: 'haiku', reason: 'Side effect detection' },
    { name: 'orchestrator', model: 'opus', reason: '3-solution finder with confidence scoring' },
  ];

  // Conditional agents
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
${chalk.bold('claude-team-init')} — AI agent team bootstrapper

${chalk.bold('Usage:')}
  npx claude-team-init [project-dir]
  npx claude-team-init .
  npx claude-team-init ~/my-project

${chalk.bold('What it does:')}
  1. Scans your codebase (language, framework, DB, auth, etc.)
  2. Generates specialized AI agents tailored to your stack
  3. Sets up a Fly.io cache server ($3/mo) for agent coordination
  4. Creates a team launcher for parallel orchestrator sessions
  5. Writes CLAUDE.md with workflow rules

${chalk.bold('Options:')}
  -h, --help      Show this help
  -v, --version   Show version
  --no-cache      Skip Fly.io setup
  --dry-run       Show what would be generated without writing files

${chalk.bold('Agents generated:')}
  Always:  build-gate, qa-signoff, regression-checker, orchestrator
  If API:  api-prober
  If auth: auth-verifier
  If DB:   security-reviewer
  If pay:  billing-bot
  And more based on what's detected...

${chalk.bold('Learn more:')} https://github.com/jwhitf4770-a11y/claude-team-init
`);
}

main().catch(err => {
  console.error(chalk.red(err.message));
  process.exit(1);
});
