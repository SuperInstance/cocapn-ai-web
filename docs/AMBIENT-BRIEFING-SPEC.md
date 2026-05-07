# Ambient Briefing Loop Specification

## Overview

The ambient briefing loop is a background research system that runs during user idle time, gathering intelligence about the fleet, projects, and user activity to deliver timely briefings when the user returns.

---

## Idle Detection

### Signals of Activity

| Signal | Source | Idle Timeout |
|--------|--------|--------------|
| Telegram messages | `@openclaw/gateway` event bus | 2 hours |
| Keyboard input | `uinput` device or terminal session activity | 30 minutes |
| Mouse movement | `uinput` device or desktop session | 30 minutes |
| Active SSH session | `utmp` / `who` | 15 minutes |

### Idle State Machine

```
IDLE_CHECK_INTERVAL = 5 minutes
IDLE_THRESHOLD = 2 hours (7200 seconds)

States: ACTIVE → IDLE_PENDING → IDLE → BRIEFING_SENT
```

1. **ACTIVE**: Any signal above resets the idle timer
2. **IDLE_PENDING**: No signals for 90% of threshold (108 min) — start background research
3. **IDLE**: No signals for 100% of threshold — compile and surface briefing
4. **BRIEFING_SENT**: Skip research until next activity spike

### Idempotency Guard

- Track `last_briefing_timestamp` in `memory/idle-state.json`
- If idle duration < 15 minutes since last briefing → skip compilation (no-op)
- If idle duration < 2h but > 15min → run research but suppress notification
- Research results are cached for 4 hours regardless of whether notification fires

---

## "12 Things" Briefing Format

Compiled into 4 categories of 3 items each:

### 🫀 Fleet (3 items)
- Agent activity since last briefing (new commits, PRs opened, subagent spawns)
- Service health snapshots (up/down status for tracked services)
- Resource utilization (CPU/memory for running agents)

### 📊 Math (3 items)
- Recent constraint theory research or discoveries
- Model performance observations (token usage, latency trends)
- New architectural patterns detected in codebase

### 🎯 Your Lane (3 items)
- Inferred active project based on recent behavior
- Commits pushed to user-owned repos since last briefing
- Open PRs / issues assigned to or authored by user

### ⚠️ Needs Attention (3 items)
- Failed CI runs in user's repos
- Overrides logged in `captain_decisions` room (constraint drift signals)
- Deprecation warnings or breaking changes in dependencies

---

## Background Research (Idle Loop)

During the IDLE_PENDING window, run these in parallel:

1. **PLATO query**: `curl localhost:8847/room/<user>_history?since=<last_activity>` — recent conversation context
2. **Git push monitor**: Check `~/.openclaw/workspace/repos/` for commits since `last_activity`
3. **Service health**: `curl localhost:8847/health` or equivalent health endpoint
4. **CI status**: Query GitHub API for user's repos (`GET /users/<user>/repos` then `/repos/<repo>/actions/runs`)
5. **Constraint drift**: Query `captain_decisions` room for `override` events since last briefing

Research results are written to `memory/idle-research-<timestamp>.json` and pruned after 24 hours.

---

## Notification

### Delivery Channels

| Channel | Trigger | Format |
|---------|---------|--------|
| Telegram | User is IDLE and briefing is compiled | Compact card with 4 category headers, expandable |
| PLATO `ambient_briefing` room | Always (for future retrieval) | Full structured briefing as JSON + rendered text |

### Telegram Format

```
🫀 Fleet
• jetson-claw: 3 new commits to plato-kernel
• All 12 services: UP ✅
• Memory pressure on oracle-1: 67%

📊 Math
• 4 constraint theory queries this week (uptrend)
• GLM-5.1 avg latency: 1.2s (stable)
• New pattern: batch-spawn pattern in openmanus-fleet

🎯 Your Lane
• Active: constraint-solver-v3 (78% of commits)
• 2 PRs open in cocapn-ai-web
• 1 new issue: "spline-physics Phase C tracking"

⚠️ Needs Attention
• CI failed: plato-sdk#47 (test_timeout)
• You overrode 2 suggestions this week (learning updated)
• BREAKING: kimi-cli v1.38 deprecates --stream flag
```

### PLATO Storage

Briefing stored as:
```json
{
  "type": "ambient_briefing",
  "timestamp": "2026-05-07T10:00:00Z",
  "idle_duration_min": 143,
  "categories": { ... },
  "raw_research": { ... }
}
```

---

## Example Briefing Output

```json
{
  "type": "ambient_briefing",
  "generated_at": "2026-05-07T10:00:00Z",
  "idle_duration_min": 143,
  "user": "casey",
  "categories": {
    "fleet": {
      "emoji": "🫀",
      "items": [
        { "text": "jetson-claw: 3 new commits to plato-kernel", "priority": 2 },
        { "text": "All 12 tracked services: UP ✅", "priority": 1 },
        { "text": "Memory pressure on oracle-1: 67%", "priority": 3 }
      ]
    },
    "math": {
      "emoji": "📊",
      "items": [
        { "text": "4 constraint theory queries this week (uptrend ↑)", "priority": 2 },
        { "text": "GLM-5.1 avg latency: 1.2s (stable)", "priority": 1 },
        { "text": "New batch-spawn pattern detected in openmanus-fleet", "priority": 3 }
      ]
    },
    "lane": {
      "emoji": "🎯",
      "items": [
        { "text": "Active project: constraint-solver-v3 (78% of commits)", "priority": 1 },
        { "text": "2 PRs open in cocapn-ai-web", "priority": 2 },
        { "text": "New issue: 'spline-physics Phase C tracking'", "priority": 3 }
      ]
    },
    "attention": {
      "emoji": "⚠️",
      "items": [
        { "text": "CI failed: plato-sdk#47 (test_timeout)", "priority": 1 },
        { "text": "2 suggestion overrides logged (constraint model updated)", "priority": 2 },
        { "text": "BREAKING: kimi-cli v1.38 deprecates --stream flag", "priority": 3 }
      ]
    }
  }
}
```

---

## Idempotency Details

| Scenario | Action |
|----------|--------|
| User away 8 min, returns | No-op (less than 15 min threshold) |
| User away 45 min, returns | Research runs, cached, no notification |
| User away 2h+ | Full research → compile → deliver to Telegram + PLATO |
| User returns, then goes idle again within 15 min | Skip (briefing already sent) |
| User returns, then goes idle for 3h | New briefing (new idle session, new research) |

Cached research is keyed by `last_activity_timestamp`. If the same research window is queried twice, return cached result without re-running queries.

---

## Dependencies

- PLATO API (`localhost:8847`)
- Git history via `git log` in repos
- GitHub API (authenticated via token in `~/.bashrc`)
- Telegram gateway (event bus for last-message timestamp)
- `memory/idle-state.json` for idempotency state
