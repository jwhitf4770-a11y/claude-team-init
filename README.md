# claude-team-init

**One command. Full AI agent team. Any codebase.**

Scans your project, detects your stack, and generates a team of specialized AI agents that build, test, audit, and QA your code — so you can ship faster and sleep while they work.

## What You Get

```
npx claude-team-init
```

```
  Scanning your codebase...
  Found: Next.js project

  Detected:
    Framework:    Next.js
    Build:        npm run build
    Tests:        Vitest
    Database:     Supabase
    Auth:         Supabase Auth
    Payments:     Stripe
    Storage:      S3

  Agents to generate:
    build-gate                haiku  Build + lint verification
    qa-signoff                haiku  Final QA with physical proof
    regression-checker        haiku  Side effect detection
    orchestrator              opus   3-solution finder with confidence scoring
    api-prober                haiku  API endpoint testing
    auth-verifier             sonnet Auth flow validation (Supabase Auth)
    billing-bot               sonnet Payment integration (Stripe)
    security-reviewer         sonnet DB security audit (Supabase)

  Generate these agents? (Y/n)
```

## The Problem

You're using Claude Code to build your app. You make a change, ask it to check the build, ask it to run tests, ask it to review for security issues. **Every check is a separate conversation that repeats work the last one already did.**

Result: wasted tokens, wasted time, wasted money.

## The Solution

`claude-team-init` generates a team of agents that:

1. **Share results** through a Fly.io cache ($3/month) — build once, reuse everywhere
2. **Specialize** — each agent knows its domain (auth, billing, security, etc.)
3. **Gate quality** — nothing ships without `qa-signoff` seeing physical proof
4. **Find the best fix, not the first fix** — the orchestrator generates 3 solutions and picks the winner

### The Orchestrator

The real power move. Give it a problem, it:

1. Generates **3 completely different solutions** (not variants — different strategies)
2. Validates each through build-gate, regression-checker, and qa-signoff
3. Scores confidence: build (30pts) + regression (30pts) + QA (25pts) + judgment (15pts)
4. Iterates until **97% confidence** or 5 rounds (92% acceptable after 5)

Run multiple problems in parallel:

```bash
./scripts/team-launch.sh "fix login timeout" "add dark mode" "optimize image loading"
```

Each gets its own tmux window and git worktree. Go to sleep. Wake up to reviewed, tested solutions on branches ready to merge.

## Savings

Real numbers from production use:

| Metric | Without Cache | With Cache |
|--------|--------------|------------|
| Test results per cycle | Re-run every time | Run once, cached 12 hours |
| Tokens per QA cycle | ~34,000 | ~250 (cache hit) |
| Daily savings (heavy use) | - | **$20-40/day** |
| Monthly savings (nightly runs) | - | **$900-1,200/month** |

The cache server costs $3/month. It pays for itself in the first hour.

## Quick Start

### Option A: npm (standalone CLI)

```bash
npx claude-team-init
```

### Option B: Claude Code skill

```
/team-init
```

### What gets created

```
your-project/
  .claude/
    agents/
      build-gate.md          # Build verification (haiku)
      qa-signoff.md          # Final QA gate (haiku)
      regression-checker.md  # Test suite runner (haiku)
      orchestrator.md        # 3-solution finder (opus)
      api-prober.md          # API testing (haiku) *
      auth-verifier.md       # Auth audit (sonnet) *
      billing-bot.md         # Payment audit (sonnet) *
      security-reviewer.md   # DB security (sonnet) *
      ...                    # * only if detected
    settings.local.json      # Permission guardrails
  scripts/
    team-launch.sh           # Parallel orchestrator launcher
    cache-hook.sh            # Fly.io cache integration
  CLAUDE.md                  # Workflow rules
```

## Supported Stacks

| Category | Detected |
|----------|----------|
| **Languages** | JavaScript/TypeScript, Python, Ruby, Go, Rust, Java/Kotlin, Dart, Swift, Elixir, PHP |
| **Frameworks** | Next.js, Nuxt, Remix, Astro, SvelteKit, React, Vue, Express, Fastify, Django, FastAPI, Flask, Rails, Gin, Axum, Actix |
| **Databases** | Supabase, Prisma, Drizzle, MongoDB, PostgreSQL, Firebase, SQLite, SQLAlchemy |
| **Auth** | NextAuth, Clerk, Supabase Auth, Firebase Auth, Passport, Lucia |
| **Payments** | Stripe, Lemon Squeezy, Paddle |
| **Storage** | S3, Supabase Storage, Google Cloud Storage, Cloudinary, Vercel Blob |
| **Testing** | Jest, Vitest, Mocha, Playwright, Cypress, pytest, RSpec, go test, cargo test |

## How the Cache Works

```
Without cache:
  build-gate runs  → npm run build (1 min)     → 24KB output
  qa-signoff runs  → npm run build (1 min)     → 24KB output  ← DUPLICATE
  regression runs  → npm run build (1 min)     → 24KB output  ← DUPLICATE

With cache:
  build-gate runs  → npm run build (1 min)     → Caches 250-byte summary
  qa-signoff runs  → Reads cache (instant)     → 250 bytes    ← SAVED
  regression runs  → Reads cache (instant)     → 250 bytes    ← SAVED
```

The cache server is a tiny Express app on Fly.io:
- In-memory key-value store with TTL
- Auth token for security
- Auto-stop when idle (saves money)
- Auto-start on first request

## FAQ

**Do I need Fly.io?**
No. The agents work without the cache — they just can't share results, so they'll repeat work. The cache is optional but saves significant money.

**Does it modify my code?**
No. It only creates files in `.claude/`, `scripts/`, and optionally `CLAUDE.md`. Your source code is never touched.

**What if I already have a CLAUDE.md?**
It appends the agent team section. Your existing rules are preserved.

**How much does it cost to run the agents?**
The agents themselves use your Claude API credits. Haiku agents are very cheap (~$0.01-0.05 per run). The orchestrator uses Opus (~$0.50-2.00 per full cycle with 3 candidates). The cache server is ~$3/month on Fly.io.

**Can I customize the agents?**
Yes. They're markdown files in `.claude/agents/`. Edit them however you want.

## License

MIT
