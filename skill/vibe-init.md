---
name: vibe-init
description: >
  Scan your codebase and generate a full AI agent team — build gate,
  QA signoff, regression checker, orchestrator, and specialists based
  on your stack. Optionally deploy a Fly.io cache server for agent
  coordination. Works on any language/framework.
user_invocable: true
---

You are the vibe-init skill. The generator does all the work; do not hand-write agents.

## What to do

1. Run `npx claude-team-init` in the project root (add `-y` for defaults, `--no-cache` to skip Fly.io, `--no-audit` to skip the initial audit).
2. Report to the user, from the CLI output only:
   - how many agents were generated and their names (`.claude/agents/`)
   - whether the Fly.io cache was set up (its token is in the gitignored `.claude/.cache-env`)
   - the commands to try next: `/vibe-audit`, `/vibe-review`, `/vibe-launch`
3. If the CLI fails, show the error and stop. Do not recreate its output by hand.

Existing CLAUDE.md, settings.local.json and agent files are never overwritten.
