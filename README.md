# claude-team-init

**Stop burning $40/day on repeated builds. Get a senior engineering team for $3/month.**

One command scans your codebase, generates specialized AI agents, and sets up a shared cache so your agents never repeat each other's work. Then `/team-audit` finds every problem in your code and fixes it.

## You Vibe Coded Your App. Now What?

You shipped fast with AI. You have users. But you have that constant low-grade anxiety:

- "What if there's a security hole I don't know about?"
- "Each fix introduces two new problems"
- "30k lines of code I didn't write and can't debug"
- "I'm burning tokens because every agent re-runs the same build"

**claude-team-init** fixes all of this.

## One Command

```bash
npx claude-team-init
```

```
  Scanning your codebase...
  Found: Next.js project

  Detected:
    Framework:    Next.js
    Database:     Supabase
    Auth:         Supabase Auth
    Payments:     Stripe
    API routes:   yes
    Mobile:       yes

  Agents to generate:
    build-gate          haiku   Build digest + security diff audit
    qa-signoff          sonnet  Final QA with physical proof, once at handoff
    regression-checker  haiku   Side effect detection
    orchestrator        opus    Candidate fixes, smallest blast radius first
    team-audit          opus    Full code audit + auto-fix
    team-review         sonnet  Fast agent team fitness check
    api-prober          haiku   API endpoint testing
    security-reviewer   sonnet  Security review (Supabase, Supabase Auth, Stripe)
    mobile-expert       sonnet  Mobile compatibility check
    security-patcher    haiku   Dependency audit auto-fix
    infra-auditor       haiku   Infra waste detection (vercel.json)

  Auto-run agents on edits and commits? Yes
  Run team audit now? Yes

  Launching team audit...
```

## What /team-audit Finds (and Fixes)

Not just warnings. **Fixes.** To 95% confidence.

| What it catches | What linters catch |
|---|---|
| 3 API routes with zero auth | Unused variable |
| SQL injection in search endpoint | Missing semicolon |
| 2,400 lines of dead code | Wrong indentation |
| Duplicated fetch logic in 8 files | Import order |
| God component with 847 lines | Trailing whitespace |
| No error boundaries anywhere | Inconsistent quotes |

After scanning, it works through every finding — critical first — fixes the code, validates the build, and iterates until the codebase is solid.

```
  TEAM-AUDIT-REPORT.md

  Health Score: 62/100

  Dead Code: 2,400 lines removed
  Duplication: 8 fetch calls → shared api.ts
  Security: 3 critical holes patched
  Missing: Error boundaries, loading states, input validation added

  Fixes Applied: 23
  Build: PASS
  Tests: PASS (47 passed, 0 failed)
  Overall Confidence: 96%
```

## Token Savings (the real money)

Your agents repeat each other's work constantly. Build-gate runs the build. Then QA runs the same build. Then regression runs it again. That's 3x the tokens for the same output.

Now there is exactly one builder: a Stop hook that builds once per turn, only when source files changed, and caches a small digest (pass/fail, error count, first 40 error lines) keyed by commit + working-tree hash. Every agent reads that digest; a build only runs again when the tree actually changed. The digest is stored locally under `.git/` and, if you set it up, on a Fly.io cache server with a persistent volume so parallel agents and worktrees share it.

| | Without Cache | With Cache |
|---|---|---|
| Tokens per QA cycle | ~34,000 | ~250 |
| Daily cost (heavy use) | $40-60 | $3-10 |
| Monthly savings | - | **$900-1,200** |

Real numbers: **4.3M tokens saved in 2 days** on a production project. The cache costs $3/month and pays for itself in the first hour.

## Inside Claude Code

After setup, just type slash commands:

```
/team-audit       Full codebase scan + fix everything
/team-review      Quick agent team fitness check
/team-launch      Parallel orchestrator for multiple problems
/team-init        Re-run setup
```

Or run agents directly:

```
claude --agent build-gate
claude --agent qa-signoff
claude --agent security-reviewer
```

## Auto-Triggers

- **End of each turn that changed source code** — one build (Stop hook). Same tree already built = skipped. Failures come back capped at 20 lines.
- **Docs, markdown, config or comment-only changes** — nothing runs, no agents spawn.
- **Before handoff** — build-gate, regression-checker and qa-signoff run once, reading the cached digest instead of rebuilding.
- **Auth, payments, uploads, database or crypto changes** — security-reviewer (one agent, a section per detected stack).
- **Opt-in** — `infra-auditor` (auto when `fly.toml`, `vercel.json`, `netlify.toml` or `supabase/config.toml` exist, or `--infra`) and `rate-limit-specialist` (auto when a rate-limit library is installed, or `--rate-limit`).

## The Orchestrator

Give it a hard problem. It:

1. Plans up to **3 genuinely different solutions** (different layers, not variants)
2. Tries them **smallest blast radius first**, one cached build per candidate
3. **Stops at the first candidate** that passes build + tests + regression-checker + qa-signoff
4. Refines the most promising failure for at most 3 rounds, then reports

```bash
./scripts/team-launch.sh "fix login timeout" "add dark mode" "optimize image loading"
```

Each problem gets its own tmux window and git worktree. Go to sleep. Wake up to tested, reviewed solutions on branches ready to merge.

## Supported Stacks

Detects and adapts to your specific tools:

| | Detected |
|---|---|
| **Languages** | JavaScript/TypeScript, Python, Ruby, Go, Rust, Java/Kotlin, Dart, Swift, Elixir, PHP |
| **Frameworks** | Next.js, Nuxt, Remix, Astro, SvelteKit, React, Vue, Express, Django, FastAPI, Flask, Rails, Gin, Axum |
| **Databases** | Supabase, Prisma, Drizzle, MongoDB, PostgreSQL, Firebase, SQLite |
| **Auth** | NextAuth, Clerk, Supabase Auth, Firebase Auth, Passport, Lucia |
| **Payments** | Stripe, Lemon Squeezy, Paddle |
| **Storage** | S3, Supabase Storage, Google Cloud Storage, Cloudinary, Vercel Blob |
| **Testing** | Jest, Vitest, Playwright, Cypress, pytest, RSpec, go test, cargo test |
| **Mobile** | iOS/SwiftUI, Android/Kotlin, Flutter, React Native |

Monorepos too — scans `web/`, `apps/`, `packages/` subdirectories automatically.

## Quick Start

### Option A: npm

```bash
npm install -g claude-team-init
cd your-project
claude-team-init
```

### Option B: npx (no install)

```bash
cd your-project
npx claude-team-init
```

### Option C: Inside Claude Code

```
/team-init
```

## What Gets Created

```
your-project/
  .claude/
    agents/           # 7-12 agents tailored to your stack
    settings.local.json  # Permissions + auto-trigger hooks
  scripts/
    team-launch.sh    # Parallel orchestrator launcher
    cache-hook.sh     # build/test digest cache (local + optional Fly.io)
  CLAUDE.md           # Workflow rules (appended, not overwritten)
  TEAM-AUDIT-REPORT.md  # Generated by /team-audit
```

Your source code is never modified during setup. Only `/team-audit` touches code (to fix what it finds).

## FAQ

**Do I need Fly.io?**
No. The digest cache works locally (under `.git/`) without it. Fly.io adds sharing across machines and survives restarts on a 1GB volume.

**How much does it cost?**
The tool is free. Cache server is ~$3/month on Fly.io. Agents use your Claude API credits (haiku: ~$0.01/run, opus orchestrator: ~$0.50-2.00/cycle).

**Can I customize the agents?**
Yes. They're markdown files. Edit anything.

**What if I already have a CLAUDE.md?**
It appends. Your existing rules stay.

**Is it safe?**
The tool only creates config files during setup. `/team-audit` makes code changes but validates everything (build + tests must pass, 95% confidence minimum).

## Built By Someone Who Burns Tokens Too

This started because I was burning 600K tokens a night running parallel AI agents on my own projects. Built the cache, saved $40/day. Built the audit, caught security holes I didn't know existed. Figured every vibe coder could use the same thing.

## License

MIT
