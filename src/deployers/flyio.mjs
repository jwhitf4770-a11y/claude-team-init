import { execSync } from 'child_process';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';

export async function deployFlyio(projectDir, audit) {
  const projectName = projectDir.split('/').pop().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const appName = `${projectName}-agent-cache`;
  const token = randomBytes(24).toString('hex');

  console.log('');
  console.log(chalk.bold('  Fly.io Cache Server Setup'));
  console.log(chalk.gray('  A tiny Express server that caches build/test results'));
  console.log(chalk.gray('  so your agents don\'t repeat each other\'s work.'));
  console.log(chalk.gray('  Cost: ~$3/month (shared-cpu-1x, 256MB)'));
  console.log('');

  // Check if flyctl is installed
  try {
    execSync('flyctl version', { stdio: 'pipe' });
  } catch {
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
    await mkdir(serverDir, { recursive: true });

    // package.json
    await writeFile(join(serverDir, 'package.json'), JSON.stringify({
      name: appName,
      version: '1.0.0',
      private: true,
      scripts: { start: 'node server.mjs' },
      dependencies: { express: '^4.18.0', 'body-parser': '^1.20.0' },
    }, null, 2));

    // server.mjs
    await writeFile(join(serverDir, 'server.mjs'), generateServerCode(token));

    // Dockerfile
    await writeFile(join(serverDir, 'Dockerfile'), `FROM node:20-slim
WORKDIR /app
COPY package.json .
RUN npm install --production
COPY . .
EXPOSE 8080
CMD ["node", "server.mjs"]
`);

    // fly.toml
    await writeFile(join(serverDir, 'fly.toml'), `app = "${appName}"
primary_region = "ord"

[build]

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = "stop"
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = "256mb"
  cpu_kind = "shared"
  cpus = 1
`);

    spinner.succeed('Cache server generated');
  } catch (err) {
    spinner.fail('Failed to generate cache server');
    console.error(chalk.red(err.message));
    return null;
  }

  // Deploy
  const { deploy } = await inquirer.prompt([{
    type: 'confirm',
    name: 'deploy',
    message: `Deploy cache server as "${appName}" on Fly.io?`,
    default: true,
  }]);

  if (!deploy) {
    console.log(chalk.gray(`  Server files saved to ${serverDir}`));
    console.log(chalk.gray('  Deploy manually: cd .agent-cache-server && fly launch'));
    return { url: `https://${appName}.fly.dev`, token, serverDir, deployed: false };
  }

  const deploySpinner = ora('Deploying to Fly.io...').start();

  try {
    execSync(`cd "${serverDir}" && flyctl launch --name ${appName} --region ord --no-deploy --yes`, {
      stdio: 'pipe',
    });

    execSync(`cd "${serverDir}" && flyctl deploy`, {
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

function generateServerCode(token) {
  return `import express from 'express';
import bodyParser from 'body-parser';

const app = express();
const PORT = process.env.PORT || 8080;
const AUTH_TOKEN = process.env.MCP_TOKEN || '${token}';

app.use(bodyParser.json({ limit: '10mb' }));

// In-memory cache with TTL
const cache = new Map();

function auth(req, res, next) {
  const bearer = req.headers.authorization?.replace('Bearer ', '');
  if (bearer !== AUTH_TOKEN) return res.status(401).json({ error: 'unauthorized' });
  next();
}

// Health
app.get('/health', (req, res) => {
  res.json({ status: 'ok', entries: cache.size, uptime: process.uptime() });
});

// Cache set
app.post('/mcp/cache-set', auth, (req, res) => {
  const { key, value, ttl = 43200, original_bytes = null } = req.body;
  if (!key) return res.status(400).json({ error: 'key required' });

  const valueStr = JSON.stringify(value);
  cache.set(key, {
    value,
    meta: {
      value_bytes: valueStr.length,
      original_bytes: original_bytes,
      read_count: 0,
      created_at: new Date().toISOString(),
    },
    expires_at: Date.now() + (ttl * 1000),
  });

  res.json({ ok: true, key });
});

// Cache get
app.get('/mcp/cache-get/:key', auth, (req, res) => {
  const entry = cache.get(req.params.key);

  if (!entry || Date.now() > entry.expires_at) {
    if (entry) cache.delete(req.params.key);
    return res.json({ error: 'cache miss' });
  }

  entry.meta.read_count++;
  res.json({ key: req.params.key, value: entry.value, meta: entry.meta });
});

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (now > entry.expires_at) cache.delete(key);
  }
}, 5 * 60 * 1000);

app.listen(PORT, () => {
  console.log(\`Cache server running on port \${PORT}\`);
});
`;
}
