# Constraint Inference Engine Specification

## Overview

The constraint inference engine learns the user's hard constraints (P0) and soft preferences (P1-P3) by observing override patterns. When the user rejects a suggestion or explicitly overrides a captain decision, that event is logged and used to update constraint parameters. The engine never suggests an override that conflicts with a hard constraint.

---

## Input: Override Events

### Sources of Override Data

| Source | Event Type | What It Signals |
|--------|-----------|-----------------|
| `captain_decisions` PLATO room | `suggestion_rejected` | User actively dismissed a suggestion |
| `captain_decisions` PLATO room | `suggestion_accepted` | Baseline behavior for learning |
| Telegram (direct) | Explicit "no, don't do that" | Verbal override, strong signal |
| Git commit | User reverts an agent's change | Implementation override |
| PLATO `oracle1_history` | User corrects agent mid-task | Correction event |

### Override Event Format

```json
{
  "type": "override_event",
  "timestamp": "2026-05-07T09:30:00Z",
  "source": "captain_decisions",
  "action_id": "suggestion-abc123",
  "topic": "math/constraint-theory",
  "suggestion_text": "Add unit tests for the constraint solver",
  "user_response": "reject",
  "reason": "not now, working on proof structure first",
  "auto_inferred": false
}
```

### Logging Overrides

Overrides are logged to `memory/override-log.jsonl` (append-only JSONL):

```json
{"ts":"2026-05-07T09:30:00Z","topic":"math/constraint-theory","action":"reject","reason":"not now"}
{"ts":"2026-05-05T14:20:00Z","topic":"fleet/github","action":"reject","reason":"CI can wait"}
```

Content is NOT logged (privacy). Only structured metadata.

---

## Learning: How Override Patterns Update Constraints

### Constraint Hierarchy

| Level | Name | Description |
|-------|------|-------------|
| P0 | HARD | Non-negotiable. Never suggest an override against these. |
| P1 | STRONG | User preference. Very hard to override with a suggestion. |
| P2 | MODERATE | Default preference. Can be suggested against with strong rationale. |
| P3 | WEAK | Gentle preference. Easily overridden by context. |

### Initial Constraints (Seed)

Hard constraints (P0) are seeded from `memory/constraints-seed.json`:

```json
[
  { "id": "no-destructive-production", "type": "P0", "description": "Never auto-commit to production branches", "source": "system" },
  { "id": "no-external-without-approval", "type": "P0", "description": "Never send external messages without explicit user ok", "source": "system" },
  { "id": "preserve-family-privacy", "type": "P0", "description": "Never mention, log, or store family member details", "source": "system" }
]
```

### Learning Algorithm

```
OVERRIDE_HALF_LIFE = 14 days
MIN_OVERRIDES_FOR_LEARNING = 3
CONVERGENCE_THRESHOLD = 0.85

def learn_from_override(event):
    topic = event.topic
    
    # Count overrides in this topic over rolling window
    override_count = count_overrides(topic, window=14days)
    accept_count = count_accepts(topic, window=14days)
    
    if override_count < MIN_OVERRIDES_FOR_LEARNING:
        return  # Not enough signal to learn
    
    reject_ratio = override_count / (override_count + accept_count)
    
    if reject_ratio > CONVERGENCE_THRESHOLD:
        # Strong pattern: elevate or create a constraint
        current = get_constraint_for_topic(topic)
        if current:
            elevate_constraint_level(current)  # P3 → P2 → P1
        else:
            create_inferred_constraint(topic, level=P2)
```

### Override → Constraint Update Rules

| Pattern | Inference | New Level |
|---------|-----------|-----------|
| 3+ rejects of suggestions in same topic (no accepts) | User strongly dislikes this type of suggestion | P1 |
| 5+ rejects across different suggestion types in same domain | Domain-wide preference | P1 |
| 1 reject followed by explicit reason "never" | Hard constraint | P0 (requires confirmation) |
| Accept then reject same suggestion type | Noise (ignore) | no change |
| Mixed accepts/rejects (<70% reject ratio) | Soft preference only | P2 |

### Why NOT Infer P0 Automatically

P0 constraints are safety-critical. The engine can **propose** P0 inference but must require:
1. Explicit user confirmation ("should this be a hard rule?")
2. OR 5+ overrides with no accepts + explicit "never" keyword in reason

---

## Output: ConstraintTile Format

```json
{
  "type": "ConstraintTile",
  "generated_at": "2026-05-07T10:00:00Z",
  "hard_constraints": [
    {
      "id": "no-destructive-production",
      "description": "Never auto-commit to production branches",
      "source": "seed",
      "confirmed": true
    },
    {
      "id": "constraint-theory-first",
      "description": "Math/constraint theory work takes priority over maintenance",
      "source": "inferred",
      "confidence": 0.89,
      "confirmed": false
    }
  ],
  "soft_preferences": [
    {
      "id": "fleet-github-low-priority",
      "topic": "fleet/github",
      "description": "GitHub fleet maintenance is low priority",
      "level": "P2",
      "confidence": 0.78,
      "overrides_count": 4,
      "accepts_count": 1
    }
  ],
  "recent_overrides": [
    {
      "topic": "math/constraint-theory",
      "count": 4,
      "window_days": 14,
      "reject_ratio": 0.80
    }
  ],
  "learning_note": "4 rejects of 'add unit tests' suggestion in constraint-theory topic → P1 preference inferred (not confirmed)"
}
```

---

## Safety: Never Suggest Against P0

### The P0 Guard

Before surfacing any suggestion, the system checks:

```
GUARD_CHECK(suggestion):
    for constraint in hard_constraints:
        if suggests_against(suggestion, constraint):
            LOG("BLOCKED: suggestion conflicts with P0 constraint", constraint.id)
            return BLOCK
    return ALLOW
```

### What "Suggests Against" Means

| Constraint | Example Blocked Suggestion |
|------------|---------------------------|
| `no-destructive-production` | "Auto-commit this fix to main" |
| `no-external-without-approval` | "I'll email the team now" |
| `preserve-family-privacy` | "Adding Magnus to the notification list" |

### P0 Violation Is Fatal

A P0 violation is logged as a **critical incident** and triggers:
1. Immediate halt of the suggestion
2. PLATO alert to `oracle1_history` room
3. User notification (Telegram) if possible

---

## Example: Constraint Inference

```
Scenario:
- User is working on constraint-solver-v3
- Agent suggests: "Add unit tests for the constraint solver"
- User rejects with reason: "not now, I'm in proof structure mode"
- Next day, same suggestion: reject "I'm focusing on correctness proofs first"
- 3rd time: reject "definitely not now"

Override Log:
{ts:"...", topic:"math/constraint-theory", action:"reject", reason:"proof structure mode"}
{ts:"...", topic:"math/constraint-theory", action:"reject", reason:"correctness proofs first"}
{ts:"...", topic:"math/constraint-theory", action:"reject", reason:"definitely not now"}

Inference:
- 3 rejects in same topic, no accepts
- Reject ratio: 100%
- Pattern: user is in a specific phase of constraint-theory work
- Threshold (MIN_OVERRIDES_FOR_LEARNING=3) reached

ConstraintTile Update:
{
  "type": "ConstraintTile",
  "soft_preferences": [
    {
      "id": "math-constraint-theory-phase-locked",
      "topic": "math/constraint-theory",
      "description": "User is in proof structure phase — defer non-math suggestions",
      "level": "P1",
      "confidence": 0.85,
      "overrides_count": 3,
      "accepts_count": 0,
      "confirmed": false
    }
  ]
}

What happens next:
- Agent stops suggesting unit tests for constraint-solver-v3
- Agent surfaces suggestions related to proof structure or formal verification instead
- After user completes proof phase (inferred from git activity shift), P1 softens to P2
```

---

## Interaction with Intent Inference

| IntentTile says | ConstraintTile says | Result |
|----------------|---------------------|--------|
| constraint-solver-v3 is active lane | unit-test suggestions blocked (P1) | No unit test suggestions |
| User shifted to plato-sdk maintenance | fleet/github P1 lifts | Maintenance suggestions allowed |
| New intent detected: writing | constraint-theory still P1 | Suggestion engine suppresses non-writing suggestions |

The two systems work together: **IntentTile** identifies the productive lane, **ConstraintTile** filters what can and cannot be suggested in that lane.

---

## Dependencies

- `captain_decisions` PLATO room (override events)
- `memory/override-log.jsonl` (append-only log)
- `memory/constraints-seed.json` (P0 seed constraints)
- `memory/ConstraintTile-last.json` (most recent output)
