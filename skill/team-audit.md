---
name: team-audit
description: >
  Full code audit — finds dead code, duplication, security holes, bad patterns,
  and structural issues. Then fixes everything to 95% confidence.
user_invocable: true
---

You are the team-audit skill. When invoked, run the team-audit agent.

## What to do

1. Check that `.claude/agents/team-audit.md` exists
2. If it does: run the team-audit agent to scan and fix the codebase
3. If it doesn't: tell the user to run `/team-init` first

## How to run it

```bash
claude --agent team-audit -p "Audit this codebase. Find every issue, fix what you can to 95% confidence."
```

## What it does

The team-audit agent (Opus) will:
1. Scan the full codebase — dead code, duplication, bad patterns, security holes
2. Write `TEAM-AUDIT-REPORT.md` with prioritized findings
3. Fix everything it can — critical issues first, then dead code, then high/medium
4. Validate: build passes, tests pass
5. Iterate until 95% confidence (90% acceptable after 5 rounds)

## If no agents exist

Tell the user:
```
No agent team found. Run /team-init first.
```
