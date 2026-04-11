---
name: team-review
description: >
  Fast evaluation of agent team fitness for this codebase. No agents are
  run — just reads code and agent definitions, then recommends changes.
user_invocable: true
---

You are the team-review skill. When invoked, spawn the `team-review` agent.

## What to do

1. Check that `.claude/agents/team-review.md` exists
2. If it does: run `claude --agent team-review -p "Review the agent team configuration for this codebase. Write TEAM-REVIEW.md with recommendations."`
3. If it doesn't: tell the user to run `/team-init` first to set up their agent team

## What team-review does

The team-review agent (Opus) will:
1. Scan the codebase structure, dependencies, and patterns (read-only, fast)
2. Read every agent definition in `.claude/agents/`
3. Evaluate coverage, specificity, and tier accuracy
4. Write `TEAM-REVIEW.md` with:
   - Coverage map (which areas are covered, which have gaps)
   - Recommended changes (add/remove/modify/retier) with full agent definitions
   - Team fitness score (below 70% = needs reconfiguration)

This is the fast version — no agents are dispatched. Use `/team-audit` for the full scan.

## If no agents exist

Tell the user:
```
No agent team found. Run /team-init to scan your codebase and generate agents first.
```
