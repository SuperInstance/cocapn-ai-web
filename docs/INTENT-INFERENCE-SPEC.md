# Intent Inference Engine Specification

## Overview

The intent inference engine reverse-engineers what the user is trying to accomplish by analyzing behavioral signals over time. It builds an `IntentTile` that feeds into captain deliberation, helping the system understand which productive lane the user is in (or should be in).

---

## Input Signals

### Signal Sources

| Signal | Source | What It Reveals |
|--------|--------|----------------|
| Telegram messages (text) | `@openclaw/gateway` message history | Explicit requests, questions, curiosities |
| Telegram message frequency | Message count per time window | Urgency, engagement level, focus |
| Git commits (repo, files changed, commit message) | `git log` in tracked repos | Active work, experiment direction |
| Git push frequency | `git push` timestamps | Momentum, priority shifts |
| PLATO room activity | `captain_decisions`, `oracle1_history` | Override patterns, suggestion采纳率 |
| Subagent spawns | OpenClaw sessions API | Delegation behavior, trust level |
| Search queries | Telegram bot commands (`/search`, `/research`) | Information-seeking behavior |
| File edits (new, deleted, renamed) | Git diff stats | Experiment or production? |
| Error/retry patterns | CI logs, agent error logs | Frustration signals, blockers |

### Signal Weighting

Signals are weighted by recency and directness:

```
RECENCY_HALF_LIFE = 7 days
BASE_WEIGHT = {
  "git_commit": 1.0,
  "telegram_message": 0.8,
  "plato_activity": 0.6,
  "subagent_spawn": 0.5,
  "file_edit": 0.9,
  "ci_failure": 0.4
}
```

Weights decay exponentially with age. A 7-day-old signal is worth half of a fresh one.

---

## Reverse-Engineering Process

### Step 1: Signal Aggregation

Collect all signals from the last 14 days into a signal vector:

```json
{
  "window_days": 14,
  "signals": [
    { "type": "git_commit", "repo": "constraint-solver", "count": 23, "last": "2026-05-06T14:00:00Z" },
    { "type": "telegram_query", "query_terms": ["constraint theory", "formal verification"], "count": 5 },
    { "type": "git_push", "repo": "plato-sdk", "count": 2 },
    { "type": "plato_override", "topic": "math", "count": 3 }
  ]
}
```

### Step 2: Pattern Detection

Detect recurring themes:

```
CLUSTERING_METHOD = keyword_embedding + frequency_analysis
THRESHOLDS:
  - REPEATED_QUERY: same/similar query 3+ times in 14 days
  - SINGLE_MENTION: flagged for follow-up, not weighted heavily
  - STRONG_SIGNAL: >5 events in same category within 7 days
```

### Step 3: Intent Hypothesis Generation

For each cluster, generate a hypothesis:

```
HYPOTHESIS = {
  "intent": "string description",
  "confidence": 0.0-1.0,
  "signals": [list of supporting signals],
  "contradicting_signals": [list],
  "derived_from": "constraint-theory-research" | "active-build" | "curiosity-spike"
}
```

### Step 4: Confidence Scoring

```python
def intent_confidence(hypothesis):
    signal_bonus = len(hypothesis.signals) * 0.1
    recency_bonus = max(0, 0.2 - days_since_most_recent(hypothesis.signals) / 50)
    contradiction_penalty = len(hypothesis.contradicting_signals) * 0.15
    return min(0.95, 0.2 + signal_bonus + recency_bonus - contradiction_penalty)
```

---

## Output: IntentTile Format

```json
{
  "type": "IntentTile",
  "generated_at": "2026-05-07T10:00:00Z",
  "window_days": 14,
  "primary_intent": {
    "description": "constraint theory research + solver implementation",
    "confidence": 0.82,
    "signals": [
      { "type": "telegram_query", "term": "constraint theory", "count": 3 },
      { "type": "git_commit", "repo": "constraint-solver-v3", "count": 23 },
      { "type": "file_edit", "files": ["solver.rs", "constraint.rs"], "count": 18 }
    ],
    "contradicting_signals": []
  },
  "secondary_intents": [
    {
      "description": "plato-sdk maintenance",
      "confidence": 0.45,
      "signals": [
        { "type": "git_push", "repo": "plato-sdk", "count": 2 }
      ]
    }
  ],
  "inferred_project": "constraint-solver-v3",
  "suggested_lane": "math/constraint-theory",
  "confidence": 0.82,
  "learning_note": "User has asked about formal verification 3x this week — strong signal for constraint solver intent"
}
```

---

## Feeding Captain Deliberation

IntentTile is consumed by the captain deliberation system:

1. **Priority ranking**: High-confidence IntentTiles bump their inferred project higher in task queue
2. **Suggestion filtering**: Suggestions that don't align with primary intent are de-prioritized (but not hidden)
3. **Proactive research**: If primary intent confidence > 0.7, trigger ambient research in that lane
4. **Override weighting**: Suggestions the user overrides repeatedly in the same lane update intent confidence

### Example: Intent-Driven Suggestion

```
User behavior (14 days):
- 23 commits to constraint-solver-v3
- 3 Telegram queries about "formal verification", "Coq", "TLA+"
- 1 override rejecting a suggestion about "add unit tests for plato-sdk"

IntentTile:
- primary_intent: "constraint solver implementation with formal foundations"
- confidence: 0.82
- suggested_lane: "math/constraint-theory"

Captain deliberation:
- Bump constraint-solver-v3 tasks to top
- Suppress suggestions about plato-sdk maintenance
- Surface research: "formal verification tools comparison" as ambient item
```

---

## Privacy

### What NOT to Log or Track

| Prohibited | Reason |
|------------|--------|
| Raw Telegram message content (full text) | Private conversation |
| Keyboard input beyond session activity timestamps | Surveillance risk |
| Mouse coordinates or heatmaps | Privacy violation |
| Subagent internal reasoning | Vendor IP |
| User location or physical behavior | Out of scope |
| Financial or health information | P0 privacy |
| Other users' data (group chats) | Privacy violation |

### What IS Logged

- Aggregated behavioral statistics (commit counts, message frequency)
- Signal types with timestamps (no content for Telegram)
- File/repo names touched (not file contents)
- Intent hypotheses (derived, not raw signals)

### Data Retention

- Signal aggregates: 30 days, then auto-pruned
- IntentTiles: 90 days in PLATO room history
- No raw message content stored beyond 48 hours

---

## Example: "User Asked About Constraint Theory 3x"

```
Signal Log (7-day window):
- 2026-05-01: "what is TLA+ formal verification" (Telegram query)
- 2026-05-03: "Coq vs Agda which is better" (Telegram query)
- 2026-05-05: "constraint theory academic" (Telegram query)
- 2026-05-02: 12 commits to constraint-solver-v3 (git)
- 2026-05-04: New files: proof_interface.rs, invariant_checker.rs (git)

IntentTile Generated:
{
  "type": "IntentTile",
  "primary_intent": {
    "description": "building a new constraint solver with formal verification",
    "confidence": 0.87,
    "signals": [
      { "type": "telegram_query", "term": "formal verification", "count": 3 },
      { "type": "git_commit", "repo": "constraint-solver-v3", "count": 12 },
      { "type": "file_edit", "files": ["proof_interface.rs", "invariant_checker.rs"], "count": 2 }
    ]
  },
  "inferred_project": "constraint-solver-v3",
  "suggested_lane": "math/constraint-theory",
  "confidence": 0.87,
  "learning_note": "3 formal verification queries in 7 days + proof-related file additions → strong intent signal"
}

Captain uses IntentTile to:
- Surface "formal verification intro" as ambient briefing item (not push notification)
- Suppress suggestions about non-math topics
- Flag constraint-solver-v3 as priority in task queue
```
