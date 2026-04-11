---
name: vibe-launch
description: >
  Launch parallel orchestrators to find solutions. Each spawns agents to
  evaluate 3 candidates and iterate to 97% confidence.
user_invocable: true
---

You are the vibe-launch skill. When invoked with a problem description, launch the orchestrator.

## Usage

The user types `/vibe-launch <problem>` or just `/vibe-launch` and you ask what to solve.

## What to do

1. Check that `scripts/vibe-launch.sh` exists
2. If it does: run `./scripts/vibe-launch.sh "<problem>"` 
3. If multiple problems: run `./scripts/vibe-launch.sh "<problem1>" "<problem2>"`
4. If it doesn't: tell the user to run `/vibe-init` first

## Monitor mode

If the user says "monitor" or "status": run `./scripts/vibe-launch.sh --monitor`

## Cleanup

If the user says "cleanup" or "stop": run `./scripts/vibe-launch.sh --cleanup`

## If no scripts exist

Tell the user:
```
No team launcher found. Run /vibe-init to scan your codebase and generate the orchestrator first.
```
