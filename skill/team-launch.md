---
name: team-launch
description: >
  Launch parallel orchestrators to find solutions. Each spawns agents to
  evaluate 3 candidates and iterate to 97% confidence.
user_invocable: true
---

You are the team-launch skill. When invoked with a problem description, launch the orchestrator.

## Usage

The user types `/team-launch <problem>` or just `/team-launch` and you ask what to solve.

## What to do

1. Check that `scripts/team-launch.sh` exists
2. If it does: run `./scripts/team-launch.sh "<problem>"` 
3. If multiple problems: run `./scripts/team-launch.sh "<problem1>" "<problem2>"`
4. If it doesn't: tell the user to run `/team-init` first

## Monitor mode

If the user says "monitor" or "status": run `./scripts/team-launch.sh --monitor`

## Cleanup

If the user says "cleanup" or "stop": run `./scripts/team-launch.sh --cleanup`

## If no scripts exist

Tell the user:
```
No team launcher found. Run /team-init to scan your codebase and generate the orchestrator first.
```
