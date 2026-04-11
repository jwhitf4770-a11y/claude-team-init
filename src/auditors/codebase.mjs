import { readFile, access } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

export async function auditCodebase(projectDir) {
  const audit = {
    language: null,
    framework: null,
    buildCmd: null,
    testCmd: null,
    testRunner: null,
    packageMgr: null,
    database: null,
    auth: null,
    payments: null,
    storage: null,
    hasApi: false,
    hasMobile: false,
    mobilePlatforms: [],    // e.g. ['ios', 'android', 'flutter', 'react-native']
    hasCrypto: false,
    hasDocker: false,
    hasCi: false,
    detectedFiles: [],
    subprojects: [],       // e.g. [{name: 'web', dir: 'web/', framework: 'Next.js'}]
    projectRoot: projectDir,
    webDir: null,           // resolved subdirectory for web app (if any)
  };

  // Check for common subdirectory layouts (monorepo / multi-platform)
  const subdirs = ['web', 'app', 'frontend', 'backend', 'server', 'api', 'src',
                   'packages/web', 'packages/app', 'apps/web', 'apps/api'];
  for (const sub of subdirs) {
    if (await fileExists(projectDir, join(sub, 'package.json'))) {
      audit.subprojects.push({ name: sub, dir: join(projectDir, sub) });
      if (!audit.webDir && ['web', 'app', 'frontend', 'apps/web', 'packages/web'].includes(sub)) {
        audit.webDir = join(projectDir, sub);
      }
    }
    if (await fileExists(projectDir, join(sub, 'requirements.txt')) ||
        await fileExists(projectDir, join(sub, 'pyproject.toml'))) {
      audit.subprojects.push({ name: sub, dir: join(projectDir, sub) });
    }
  }

  // If we found a web subdirectory, scan it as the primary project
  // but keep projectDir as the root for agent generation
  const scanDir = audit.webDir || projectDir;

  // Detect language and package manager
  const checks = [
    { file: 'package.json', lang: 'JavaScript/TypeScript', pkg: 'npm' },
    { file: 'yarn.lock', lang: 'JavaScript/TypeScript', pkg: 'yarn' },
    { file: 'pnpm-lock.yaml', lang: 'JavaScript/TypeScript', pkg: 'pnpm' },
    { file: 'bun.lockb', lang: 'JavaScript/TypeScript', pkg: 'bun' },
    { file: 'requirements.txt', lang: 'Python', pkg: 'pip' },
    { file: 'pyproject.toml', lang: 'Python', pkg: 'pip' },
    { file: 'Pipfile', lang: 'Python', pkg: 'pipenv' },
    { file: 'Gemfile', lang: 'Ruby', pkg: 'bundler' },
    { file: 'go.mod', lang: 'Go', pkg: 'go' },
    { file: 'Cargo.toml', lang: 'Rust', pkg: 'cargo' },
    { file: 'build.gradle', lang: 'Java/Kotlin', pkg: 'gradle' },
    { file: 'pom.xml', lang: 'Java', pkg: 'maven' },
    { file: 'pubspec.yaml', lang: 'Dart', pkg: 'pub' },
    { file: 'Package.swift', lang: 'Swift', pkg: 'spm' },
    { file: 'mix.exs', lang: 'Elixir', pkg: 'mix' },
    { file: 'composer.json', lang: 'PHP', pkg: 'composer' },
  ];

  for (const check of checks) {
    if (await fileExists(scanDir, check.file)) {
      audit.language = audit.language || check.lang;
      audit.packageMgr = audit.packageMgr || check.pkg;
      audit.detectedFiles.push(check.file);
    }
  }

  // Parse package.json for JS/TS projects (scan the web/app subdir if found)
  const pkgJson = await readJsonSafe(scanDir, 'package.json');
  if (pkgJson) {
    const deps = {
      ...pkgJson.dependencies,
      ...pkgJson.devDependencies,
    };
    const scripts = pkgJson.scripts || {};

    // Framework detection
    if (deps['next'])               audit.framework = 'Next.js';
    else if (deps['nuxt'])          audit.framework = 'Nuxt';
    else if (deps['@remix-run/react']) audit.framework = 'Remix';
    else if (deps['astro'])         audit.framework = 'Astro';
    else if (deps['svelte'])        audit.framework = 'SvelteKit';
    else if (deps['vue'])           audit.framework = 'Vue';
    else if (deps['react'])         audit.framework = 'React';
    else if (deps['express'])       audit.framework = 'Express';
    else if (deps['fastify'])       audit.framework = 'Fastify';
    else if (deps['hono'])          audit.framework = 'Hono';

    // Build command (prefix with cd if scanning a subdirectory)
    const cdPrefix = audit.webDir ? `cd ${audit.webDir.split('/').pop()} && ` : '';
    if (scripts.build)        audit.buildCmd = `${cdPrefix}npm run build`;
    else if (scripts.compile) audit.buildCmd = `${cdPrefix}npm run compile`;

    // Test command and runner
    if (scripts.test) {
      audit.testCmd = `${cdPrefix}npm test`;
      if (deps['jest'] || deps['@jest/core'])     audit.testRunner = 'Jest';
      else if (deps['vitest'])                     audit.testRunner = 'Vitest';
      else if (deps['mocha'])                      audit.testRunner = 'Mocha';
      else if (deps['@playwright/test'])           audit.testRunner = 'Playwright';
      else if (deps['cypress'])                    audit.testRunner = 'Cypress';
    }

    // Database
    if (deps['@supabase/supabase-js'])             audit.database = 'Supabase';
    else if (deps['prisma'] || deps['@prisma/client']) audit.database = 'Prisma';
    else if (deps['drizzle-orm'])                  audit.database = 'Drizzle';
    else if (deps['mongoose'])                     audit.database = 'MongoDB';
    else if (deps['pg'] || deps['postgres'])       audit.database = 'PostgreSQL';
    else if (deps['firebase'] || deps['firebase-admin']) audit.database = 'Firebase';
    else if (deps['better-sqlite3'])               audit.database = 'SQLite';

    // Auth
    if (deps['next-auth'] || deps['@auth/core'])   audit.auth = 'NextAuth';
    else if (deps['@clerk/nextjs'])                audit.auth = 'Clerk';
    else if (deps['@supabase/ssr'] || deps['@supabase/auth-helpers-nextjs']) audit.auth = 'Supabase Auth';
    else if (deps['firebase'])                     audit.auth = audit.auth || 'Firebase Auth';
    else if (deps['passport'])                     audit.auth = 'Passport';
    else if (deps['lucia'])                        audit.auth = 'Lucia';

    // Payments
    if (deps['stripe'] || deps['@stripe/stripe-js']) audit.payments = 'Stripe';
    else if (deps['@lemonsqueezy/lemonsqueezy.js'])  audit.payments = 'Lemon Squeezy';
    else if (deps['@paddle/paddle-node-sdk'])        audit.payments = 'Paddle';

    // Storage
    if (deps['@aws-sdk/client-s3'] || deps['aws-sdk']) audit.storage = 'S3';
    else if (deps['@supabase/storage-js'])             audit.storage = 'Supabase Storage';
    else if (deps['@google-cloud/storage'])            audit.storage = 'Google Cloud Storage';
    else if (deps['cloudinary'])                       audit.storage = 'Cloudinary';
    else if (deps['@vercel/blob'])                     audit.storage = 'Vercel Blob';

    // Crypto
    if (deps['crypto-js'] || deps['tweetnacl'] || deps['@noble/ciphers']) {
      audit.hasCrypto = true;
    }
  }

  // Python framework detection
  const pyproject = await readFileSafe(scanDir, 'pyproject.toml');
  const requirements = await readFileSafe(scanDir, 'requirements.txt');
  const pyDeps = (pyproject || '') + (requirements || '');

  if (pyDeps) {
    if (pyDeps.includes('django'))        audit.framework = audit.framework || 'Django';
    else if (pyDeps.includes('fastapi'))  audit.framework = audit.framework || 'FastAPI';
    else if (pyDeps.includes('flask'))    audit.framework = audit.framework || 'Flask';

    if (pyDeps.includes('pytest'))        { audit.testCmd = audit.testCmd || 'pytest'; audit.testRunner = 'pytest'; }
    if (pyDeps.includes('stripe'))        audit.payments = audit.payments || 'Stripe';
    if (pyDeps.includes('sqlalchemy'))    audit.database = audit.database || 'SQLAlchemy';
    if (pyDeps.includes('cryptography'))  audit.hasCrypto = true;
  }

  // Ruby framework detection
  const gemfile = await readFileSafe(scanDir, 'Gemfile');
  if (gemfile) {
    if (gemfile.includes('rails'))        audit.framework = audit.framework || 'Rails';
    if (gemfile.includes('rspec'))        { audit.testCmd = audit.testCmd || 'bundle exec rspec'; audit.testRunner = 'RSpec'; }
    if (gemfile.includes('stripe'))       audit.payments = audit.payments || 'Stripe';
  }

  // Go detection
  const goMod = await readFileSafe(scanDir, 'go.mod');
  if (goMod) {
    audit.buildCmd = audit.buildCmd || 'go build ./...';
    audit.testCmd = audit.testCmd || 'go test ./...';
    audit.testRunner = 'go test';
    if (goMod.includes('gin-gonic'))      audit.framework = audit.framework || 'Gin';
    else if (goMod.includes('fiber'))     audit.framework = audit.framework || 'Fiber';
    else if (goMod.includes('echo'))      audit.framework = audit.framework || 'Echo';
  }

  // Rust detection
  const cargoToml = await readFileSafe(scanDir, 'Cargo.toml');
  if (cargoToml) {
    audit.buildCmd = audit.buildCmd || 'cargo build';
    audit.testCmd = audit.testCmd || 'cargo test';
    audit.testRunner = 'cargo test';
    if (cargoToml.includes('actix'))      audit.framework = audit.framework || 'Actix';
    else if (cargoToml.includes('axum'))  audit.framework = audit.framework || 'Axum';
    else if (cargoToml.includes('rocket')) audit.framework = audit.framework || 'Rocket';
  }

  // API routes detection (scan both root and web subdir)
  const apiPatterns = [
    'app/api/**', 'src/api/**', 'pages/api/**', 'routes/**',
    'src/routes/**', 'app/routes/**', 'controllers/**',
    'web/app/api/**', 'server/api/**', 'backend/api/**',
  ];
  for (const pattern of apiPatterns) {
    const matches = await glob(pattern, { cwd: projectDir, nodir: true });
    if (matches.length > 0) {
      audit.hasApi = true;
      break;
    }
  }

  // Mobile detection — per-platform
  const iosFiles = await glob('{ios,iOS,*-ios}/**/*.swift', { cwd: projectDir, nodir: true });
  const watchFiles = await glob('{Watch,watchOS,WatchKit}/**/*.swift', { cwd: projectDir, nodir: true });
  const androidFiles = await glob('{android,*-android}/**/*.{kt,java}', { cwd: projectDir, nodir: true });
  const flutterFile = await glob('lib/main.dart', { cwd: projectDir, nodir: true });
  const rnFile = await glob('App.tsx', { cwd: projectDir, nodir: true });

  if (iosFiles.length > 0 || watchFiles.length > 0) audit.mobilePlatforms.push('ios');
  if (watchFiles.length > 0) audit.mobilePlatforms.push('watchos');
  if (androidFiles.length > 0) audit.mobilePlatforms.push('android');
  if (flutterFile.length > 0) audit.mobilePlatforms.push('flutter');
  if (rnFile.length > 0) audit.mobilePlatforms.push('react-native');
  audit.hasMobile = audit.mobilePlatforms.length > 0;

  // iOS/Swift specific detection
  const swiftFiles = await glob('**/*.swift', {
    cwd: projectDir, nodir: true, ignore: ['node_modules/**', '.build/**', 'Pods/**']
  });
  if (swiftFiles.length > 0) {
    audit.hasMobile = true;
    if (!audit.mobilePlatforms.includes('ios')) audit.mobilePlatforms.push('ios');
    if (!audit.language) audit.language = 'Swift';

    // Detect Xcode project for build/test commands
    const xcodeProjects = await glob('*.xcodeproj', { cwd: projectDir });
    const xcworkspaces = await glob('*.xcworkspace', { cwd: projectDir });
    if (xcworkspaces.length > 0 || xcodeProjects.length > 0) {
      const workspace = xcworkspaces[0];
      const project = xcodeProjects[0];
      if (workspace) {
        // Detect scheme from workspace name
        const schemeName = workspace.replace('.xcworkspace', '');
        audit.iosBuildCmd = `xcodebuild -workspace ${workspace} -scheme ${schemeName} -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build`;
        audit.iosTestCmd = `xcodebuild -workspace ${workspace} -scheme ${schemeName} -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' test`;
      } else if (project) {
        const schemeName = project.replace('.xcodeproj', '');
        audit.iosBuildCmd = `xcodebuild -project ${project} -scheme ${schemeName} -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' build`;
        audit.iosTestCmd = `xcodebuild -project ${project} -scheme ${schemeName} -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 16' test`;
      }
    }

    // Check for Supabase in Swift
    for (const sf of swiftFiles.slice(0, 20)) {
      const content = await readFileSafe(projectDir, sf);
      if (content && content.includes('supabase')) {
        audit.database = audit.database || 'Supabase';
        break;
      }
    }
  }

  // Supabase directory detection (common in multi-platform projects)
  if (await fileExists(projectDir, 'supabase')) {
    audit.database = audit.database || 'Supabase';
  }

  // Docker
  audit.hasDocker = await fileExists(projectDir, 'Dockerfile') ||
                    await fileExists(projectDir, 'docker-compose.yml');

  // CI
  audit.hasCi = await fileExists(projectDir, '.github/workflows') ||
                await fileExists(projectDir, '.gitlab-ci.yml') ||
                await fileExists(projectDir, 'vercel.json') ||
                await fileExists(projectDir, 'netlify.toml');

  // Crypto (file-level scan)
  if (!audit.hasCrypto) {
    const cryptoFiles = await glob('**/crypto/**/*.{ts,js,py,rb,go,rs}', {
      cwd: projectDir, nodir: true, ignore: ['node_modules/**', 'vendor/**', '.git/**']
    });
    if (cryptoFiles.length > 0) audit.hasCrypto = true;
  }

  return audit;
}

async function fileExists(dir, file) {
  try {
    await access(join(dir, file));
    return true;
  } catch {
    return false;
  }
}

async function readFileSafe(dir, file) {
  try {
    return await readFile(join(dir, file), 'utf-8');
  } catch {
    return null;
  }
}

async function readJsonSafe(dir, file) {
  const content = await readFileSafe(dir, file);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}
