---
name: vibe-crew
description: >
  Show all available vibe-crew commands, when to use each, and what runs automatically.
user_invocable: true
---

You are the vibe-crew help skill. When invoked, display the guide below exactly as written.

## What to display

```
Vibe Crew — Your AI engineering team

FIRST TIME SETUP (do this once per project):
  npx vibe-crew -y          Scans your code, generates agents, deploys cache

WHAT HAPPENS AUTOMATICALLY (you don't need to do anything):
  - Every time you edit a file → build-gate checks it compiles
  - Every time you commit → full pipeline runs (build + tests + regression check)
  - Touch auth code → auth-verifier activates
  - Touch payment code → billing-bot activates
  - Touch database code → security-reviewer activates
  These are configured in .claude/settings.local.json and .claude/rules.json

COMMANDS YOU RUN YOURSELF:
  /vibe-audit     "My code feels messy" — finds dead code, duplication,
                  security holes, bad patterns. Fixes everything to 95%.
                  Run this after a big build session or before shipping.

  /vibe-review    "Are my agents right for this project?" — reads your
                  codebase and agent configs, recommends changes.
                  Run this after major refactors or adding new tech.

  /vibe-launch    "I have a hard problem" — launches parallel orchestrators
                  that each find 3 solutions and pick the best one.
                  Run this for complex bugs or architecture decisions.

  /vibe-init      Re-run setup (after adding new frameworks, databases, etc.)

  /vibe-crew      Show this help

TYPICAL WORKFLOW:
  1. Code normally — agents guard you automatically
  2. Before shipping → /vibe-audit
  3. Something complex → /vibe-launch "describe the problem"
  4. Added new tech → /vibe-init to regenerate agents
```
