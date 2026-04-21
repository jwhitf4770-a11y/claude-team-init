---
name: Fly.io default for cache
description: Use Fly.io MCP cache (cache_get / cache_set / session_save) as default for any cross-agent state, not local files or in-memory state
type: feedback
originSessionId: 61129cdf-0143-4adb-bd57-5b3229b2dbe4
---
Fly.io MCP should be the default caching substrate for all multi-agent work (cache keys, session state, shared artifacts, orchestrator results). Not local files, not repeated tool-call re-research.

**Why:** User pays for Fly.io and it's already integrated (~3x faster validation, 7.47M+ tokens saved per lifetime stats). Running many local agents in parallel can kill the system — distributed cache keeps state out of local memory and lets agents resume cleanly across wakeups.

**How to apply:**
- Any orchestrator prompt should include a `cache key: orch-<feature>-result` line and instruct candidates to write to Fly.io cache
- Cross-agent handoffs (stack-architect → orchestrator, security-reviewer → qa-signoff) should use `cache_set` / `cache_get` not context forwarding
- Long-running overnight runs should `session_save` periodically so wakeups pick up from cache rather than re-doing work
- Heavy compute (builds, tests across platforms) should prefer `exec_bash` on Fly.io over spawning many local agents
- When asked "should I spawn another agent?" — first check if the answer is already in Fly.io cache
