# claude-team-init — Marketing Strategy

## The Problem (in their words)

> "I have this constant low-grade anxiety that somewhere in the codebase there's a function that's one wrong input away from catastrophic failure." — r/vibecoding

> "Built my SaaS in 3 days. Last week I sat down to add one small feature. One day gone. 30k lines of backend. 8k lines of frontend for 7 screens." — r/startups

> "Each fix introduces two new problems because the LLM has no memory of why it made those architectural decisions." — r/vibecoding, 572 upvotes

> "I'm thinking of starting an agency that charges $500 per hour to fix the vibecoded shit code from startups." — r/vibecoding

## Target Audience

**Primary:** Solo developers and indie hackers who built their app with AI (Cursor, Copilot, Claude) and are burning tokens on repeated builds while shipping code they can't maintain.

**The "I shipped but I'm scared" segment:** They have paying users. They know the code is fragile. They just don't know WHERE the problems are.

## Value Props (in priority order)

### 1. Stop Burning Tokens ($20-40/day savings)

Every time Claude runs a build, runs tests, or checks the same files — that's tokens you already paid for. Your agents repeat each other's work constantly.

**claude-team-init** sets up a shared cache so agents never duplicate work. Build results, test output, security scans — run once, shared everywhere.

- Real user data: 4.3M tokens saved in 2 days (~$54)
- Heavy usage: $20-40/day in savings
- Cache server cost: $3/month
- ROI: pays for itself in the first hour

### 2. Your Code Gets Fixed, Not Just Flagged

Linters tell you a variable is unused. We find your authentication is broken AND fix it.

`/team-audit` sends a full agent team through your codebase:
- Dead code scan (AI loves generating extra stuff)
- Copy-paste duplication (DRY up repeated fetch calls, validation, error handling)
- Security holes (exposed API keys, missing auth, SQL injection)
- Bad patterns (God files, swallowed errors, hardcoded values)
- Missing essentials (no tests, no error boundaries, no loading states)

Then it **fixes everything to 95% confidence** — critical issues first, validates the build, iterates until it's right.

### 3. One Command, Zero Config

```bash
npx claude-team-init
```

That's it. It scans your codebase, detects your stack, and generates:
- Specialized AI agents tailored to YOUR code
- Build gate (catches errors before they ship)
- QA signoff (requires proof, not assumptions)
- Security reviewer (knows your DB, your auth, your stack)
- Orchestrator (finds 3 solutions, picks the best one)

No GitHub integration. No YAML config. No DevOps knowledge required.

## Positioning

### What we are
**A senior engineering team for every solo developer, in one command.**

### What we're not
- Not a linter (ESLint finds syntax; we find architecture)
- Not a PR reviewer (CodeRabbit reviews after you ship; we prevent before you commit)
- Not another AI coding tool (Cursor/Copilot generate code; we review and fix it)

### The gap we fill
| | Linters | CodeRabbit | SonarQube | claude-team-init |
|---|---|---|---|---|
| Finds syntax issues | Yes | Yes | Yes | Yes |
| Finds security holes | Some | Some | Yes | Yes |
| Finds architectural problems | No | Partial | No | **Yes** |
| Prevents bad commits | No | No | No | **Yes** |
| Fixes the problems | No | No | No | **Yes** |
| Zero config | N/A | Moderate | No | **Yes** |
| Saves tokens | No | No | No | **Yes** |

## Competitive Landscape

**No one targets solo AI-assisted developers who need architectural review.**

- CodeRabbit ($12/mo) — PR review only, reactive, no build gate
- SonarQube — Enterprise-focused, heavy config, rule-based
- Codacy ($15/user/mo) — Pattern matching, no reasoning
- DeepSource ($12/user/mo) — Limited autofix, no architecture
- Linters (free) — Syntax only

**Our moat:** The agent configurations encode senior engineering judgment. Anyone can wire up an LLM to review code. The value is in what each agent looks for, when to escalate, and how agents build on each other's findings.

## Messaging by Channel

### Twitter/X (primary — viral screenshots)
Hook: savings numbers + scary findings

**Post 1 — The savings hook:**
"Ran claude-team-init on my project. My agents were burning $40/day repeating each other's work. Added a $3/month cache, now they share results. 4.3M tokens saved in 2 days. One command."

**Post 2 — The scary audit:**
"Ran /team-audit on a vibe-coded SaaS with paying users. Found:
- 3 API routes with zero auth
- 2,400 lines of dead code
- SQL injection in the search endpoint
- 47 console.logs in production
All fixed in 20 minutes. The developer had no idea."

**Post 3 — The emotional hook:**
"If you vibe-coded your app and have that constant low-grade anxiety about what's hiding in your codebase — /team-audit was built for you. One command. It finds everything and fixes it."

### Reddit (r/ClaudeAI, r/vibecoding, r/SideProject, r/webdev)

**Title:** "I built a tool that gives vibe-coded projects a full senior engineering team — one command"

**Body:**
I was burning $40/day on Claude tokens because my agents kept repeating each other's work. Built a cache layer, saved 4.3M tokens in 2 days.

Then I thought — what if every vibe coder could have this?

`npx claude-team-init` scans your project, detects your stack, and generates:
- A shared cache so agents never duplicate work ($3/mo, saves $20-40/day)
- Build gate that catches errors before you ship
- Security reviewer that knows YOUR database and auth setup
- /team-audit that finds dead code, security holes, and bad patterns — then fixes them to 95% confidence

It's like hiring a senior engineering team that works for $3/month.

Works with: Next.js, React, Python, Go, Rust, Ruby, Swift, and more.

### YouTube (demo video script — 60 seconds)

"Every vibe coder has the same problem. You shipped fast, you have users, but you're scared to touch your own code.

Watch this. One command.

[screen: npx claude-team-init running, detecting Next.js + Supabase]

It found my stack. Generated 8 agents. Deployed a cache server.

Now watch what /team-audit finds.

[screen: audit running, findings appearing]

3 security holes. 2,000 lines of dead code. Missing error boundaries everywhere.

Here's the part that matters — it doesn't just find problems. It fixes them.

[screen: fixes being applied, build passing, 96% confidence]

$3 a month. Saves $40 a day in tokens. Fixes your code while you sleep.

Link in bio."

### Product Hunt

**Tagline:** "A senior engineering team for your AI-generated code — one command"

**Description:**
You built fast with AI. Now who reviews it?

claude-team-init scans your codebase, generates specialized AI agents for YOUR stack, and sets up a shared cache that saves $20-40/day in tokens.

Then /team-audit sends the whole team through your code — finds dead code, security holes, bad patterns — and fixes everything to 95% confidence.

One command. Zero config. Works with any language.

## Pricing Strategy

### Free tier (the tool itself)
- `npx claude-team-init` — free forever
- Agent generation — free
- /team-audit, /team-review — free (uses their own Claude API credits)

### Paid tier (the cache server)
- Fly.io shared cache: ~$3/month (they deploy it themselves)
- Saves $20-40/day → ROI in first hour

### Future SaaS tier (hosted dashboard)
- Pro: $9/month — managed cache, savings dashboard, 1000 cache keys
- Team: $29/month — team features, 5000 keys, shared agents

### Why this works
- Zero friction to start (free tool, immediate value)
- Cache pays for itself instantly (visible savings)
- Dashboard is the upsell (convenience, not capability)

## Distribution Priorities

1. **Twitter/X** — Screenshots of savings numbers and audit findings go viral
2. **Reddit** — r/ClaudeAI, r/vibecoding, r/SideProject, r/webdev
3. **Product Hunt** — Launch day buzz
4. **YouTube** — 60-second demo, partner with AI coding channels
5. **Discord** — Cursor, Claude, Vercel communities
6. **Hacker News** — Show HN post

## Key Metrics to Track

- GitHub stars (social proof)
- npm weekly downloads
- Cache servers deployed (paying users)
- Tokens saved (aggregate — use for marketing)
- /team-audit runs (engagement)

## Pain Points We Solve (mapped to features)

| Pain Point (from Reddit) | Feature |
|---|---|
| "Burning tokens on repeated work" | Fly.io shared cache |
| "Can't maintain what I built" | /team-audit finds + fixes structural issues |
| "Constant anxiety about unknown bugs" | /team-audit scans everything, reports what it finds |
| "Each fix introduces two new problems" | Orchestrator finds 3 solutions, validates each to 97% |
| "No tests or meaningless tests" | test-writer agent generates real tests |
| "Security vulnerabilities I don't know about" | security-reviewer agent, scoped to YOUR stack |
| "Code bloat and duplication" | Dead code scan + DRY recommendations |
| "Can't debug without AI making it worse" | Build gate blocks bad code before commit |
| "30k lines I can't navigate" | /team-review maps your codebase, recommends structure |
| "Works locally, breaks in production" | regression-checker + qa-signoff require proof |
