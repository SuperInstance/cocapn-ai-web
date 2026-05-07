# Phase 2 Implementation Plan: Ambient Briefing Loop

## Overview

Phase 2 implements the ambient briefing loop and supporting inference engines. This document covers dependencies, implementation order, component specifications, and testing strategy.

---

## What Depends on What

```
COMPONENT DEPENDENCY GRAPH:

PLATO API (existing)
  └── ambient-loop.js (background process)
        └── idle-detector.js
        └── research-collector.js
              ├── git-monitor.js
              ├── service-health.js
              └── ci-status.js
        └── briefing-compiler.js
              └── IntentTile (from INTENT-INFERENCE-SPEC)
              └── ConstraintTile (from CONSTRAINT-INFERENCE-SPEC)
        └── notification-dispatcher.js
              ├── telegram-delivery.js
              └── plato-storage.js
```

### Hard Dependencies

| Component | Must Be Built First |
|-----------|---------------------|
| `memory/idle-state.json` schema | idle-detector |
| PLATO API (`localhost:8847`) | research-collector |
| IntentTile schema | briefing-compiler |
| ConstraintTile schema | briefing-compiler |
| P0 constraint seed data | notification-dispatcher (safety gate) |

### No Hard Dependencies (Can Be Built in Parallel)

| Component | Independent Of |
|-----------|----------------|
| git-monitor.js | Everything except PLATO API |
| service-health.js | Everything except PLATO API |
| ci-status.js | GitHub token in environment |
| telegram-delivery.js | briefing-compiler output |
| plato-storage.js | briefing-compiler output |

---

## Implementation Order

### Step 1: Build the Idle Detector (`idle-detector.js`)

**Goal:** Detect when user goes idle and transitions through state machine.

**Deliverables:**
- `src/ambient/idle-detector.js` — state machine (ACTIVE → IDLE_PENDING → IDLE → BRIEFING_SENT)
- `memory/idle-state.json` — persisted state (timestamps, current state)
- `src/ambient/idle-detector.test.js` — unit tests

**Testability:** Mock Telegram messages and keyboard activity signals to transition states without waiting.

**Acceptance Criteria:**
- [ ] State transitions fire at correct thresholds (90% / 100% of 2h)
- [ ] State persists across process restarts
- [ ] Idempotency guard prevents double-send within 15 min

---

### Step 2: Build the Research Collector (`research-collector.js`)

**Goal:** Gather intelligence during IDLE_PENDING window.

**Deliverables:**
- `src/ambient/research-collector.js` — parallel orchestrator
- `src/ambient/collectors/git-monitor.js` — git commit/push history
- `src/ambient/collectors/service-health.js` — service up/down checks
- `src/ambient/collectors/ci-status.js` — GitHub CI run status
- `src/ambient/collectors/plato-query.js` — PLATO room history

**Acceptance Criteria:**
- [ ] All collectors run in parallel during IDLE_PENDING
- [ ] Results written to `memory/idle-research-<ts>.json`
- [ ] Cache hit returns cached results without re-querying
- [ ] Research completes within 5 minutes (before IDLE threshold fires)

---

### Step 3: Build the Briefing Compiler (`briefing-compiler.js`)

**Goal:** Transform raw research into "12 things" briefing format.

**Deliverables:**
- `src/ambient/briefing-compiler.js` — compile research → 12 things
- `src/ambient/formatters/telegram-format.js` — Telegram card format
- `src/ambient/formatters/plato-format.js` — PLATO JSON format

**Acceptance Criteria:**
- [ ] Input: research data + IntentTile + ConstraintTile
- [ ] Output: 12-item briefing (4 categories × 3 items)
- [ ] Telegram format fits card layout (compact, emoji headers)
- [ ] PLATO format is valid JSON with all metadata

**Depends on:** IntentTile schema, ConstraintTile schema

---

### Step 4: Build the Notification Dispatcher (`notification-dispatcher.js`)

**Goal:** Deliver briefing to Telegram and/or PLATO based on idle state.

**Deliverables:**
- `src/ambient/notification-dispatcher.js` — routing logic
- `src/ambient/delivery/telegram-delivery.js` — Telegram send
- `src/ambient/delivery/plato-storage.js` — PLATO room write

**Acceptance Criteria:**
- [ ] IDLE → Telegram + PLATO delivery
- [ ] IDLE_PENDING with short idle (< 15 min) → PLATO only
- [ ] P0 guard fires → suggestion blocked, critical log written
- [ ] Duplicate send prevented (briefing-sent flag)

---

### Step 5: Build the Ambient Loop Orchestrator (`ambient-loop.js`)

**Goal:** Wire everything together, manage process lifecycle.

**Deliverables:**
- `src/ambient/ambient-loop.js` — main loop entrypoint
- `src/ambient/config.js` — thresholds, intervals, feature flags

**Acceptance Criteria:**
- [ ] 5-minute idle check interval fires reliably
- [ ] Graceful shutdown (finish in-progress research, don't interrupt delivery)
- [ ] Process auto-restarts via systemd or PM2
- [ ] Logs to `memory/ambient-loop.log`

---

### Step 6 (Future): Idle Detection Tuning

**Goal:** Calibrate thresholds based on real usage patterns.

**Deliverables:**
- `src/ambient/tuning/trigger-analysis.js` — analyze actual idle patterns
- `memory/idle-patterns.json` — observed idle distributions

**Tuning targets:**
- Reduce false IDLE_PENDING triggers (user is just reading)
- Adjust thresholds if user consistently returns in < 90 min

---

## Testing Without Waiting 2 Hours

### Mock Idle Signals

Override the idle detector's clock:

```javascript
// In test environment, patch time.now()
const originalNow = Date.now;
Date.now = () => originalNow() + (2 * 60 * 60 * 1000); // Fast-forward 2 hours

// Or expose test interface:
idleDetector.setFakeIdleDuration(7200); // 2 hours in seconds
```

### Unit Test Strategy

**idle-detector.test.js:**
```javascript
test('fires IDLE_PENDING at 90% threshold', () => {
  const detector = new IdleDetector({ threshold: 7200 });
  detector.setFakeIdle(6480); // 90% = 6480s
  expect(detector.state).toBe('IDLE_PENDING');
});

test('fires IDLE at 100% threshold', () => {
  const detector = new IdleDetector({ threshold: 7200 });
  detector.setFakeIdle(7200);
  expect(detector.state).toBe('IDLE');
  expect(detector.shouldNotify).toBe(true);
});

test('idempotency: skip if last briefing < 15 min ago', () => {
  const detector = new IdleDetector({ threshold: 7200 });
  detector.setFakeIdle(7200);
  detector.lastBriefingTimestamp = Date.now() - (10 * 60 * 1000); // 10 min ago
  expect(detector.shouldNotify).toBe(false);
});
```

**research-collector.test.js:**
```javascript
test('returns cached results if fresh', async () => {
  const collector = new ResearchCollector();
  const cached = { timestamp: Date.now() - (60 * 60 * 1000), data: {} }; // 1h old
  collector.cache.get = () => cached;
  
  const result = await collector.run();
  expect(result.fromCache).toBe(true);
  expect(collector.queryGit).toHaveBeenCalledTimes(0); // No re-query
});
```

### Integration Test: Mock Full Flow

```javascript
test('full flow: idle → research → briefing → notify', async () => {
  // 1. Fast-forward idle timer
  idleDetector.setFakeIdle(7200);
  
  // 2. Mock research results
  researchCollector.mockResults = { fleet: [...], math: [...], ... };
  
  // 3. Mock IntentTile + ConstraintTile
  intentEngine.mockTile = { primary_intent: {...} };
  constraintEngine.mockTile = { hard_constraints: [...] };
  
  // 4. Run loop
  await ambientLoop.runOnce();
  
  // 5. Assert
  expect(telegramDeliver).toHaveBeenCalledWith(briefingMatcher);
  expect(platoStorage).toHaveBeenCalledWith(briefingMatcher);
  expect(idleDetector.state).toBe('BRIEFING_SENT');
});
```

---

## File Structure

```
repos/cocapn-ai-web/
├── src/
│   └── ambient/
│       ├── ambient-loop.js          # Main entrypoint
│       ├── idle-detector.js         # State machine
│       ├── research-collector.js    # Orchestrator
│       ├── briefing-compiler.js     # 12 things formatter
│       ├── notification-dispatcher.js
│       ├── config.js                # Thresholds, intervals
│       ├── collectors/
│       │   ├── git-monitor.js
│       │   ├── service-health.js
│       │   ├── ci-status.js
│       │   └── plato-query.js
│       ├── delivery/
│       │   ├── telegram-delivery.js
│       │   └── plato-storage.js
│       └── formatters/
│           ├── telegram-format.js
│           └── plato-format.js
├── memory/
│   ├── idle-state.json             # Persisted idle state
│   ├── idle-research-<ts>.json     # Cached research
│   └── ConstraintTile-last.json   # Most recent constraint tile
├── docs/
│   ├── AMBIENT-BRIEFING-SPEC.md
│   ├── INTENT-INFERENCE-SPEC.md
│   ├── CONSTRAINT-INFERENCE-SPEC.md
│   └── PHASE-2-IMPLEMENTATION.md
└── tests/
    └── ambient/
        ├── idle-detector.test.js
        ├── research-collector.test.js
        ├── briefing-compiler.test.js
        └── integration.test.js
```

---

## Rollout Checklist

- [ ] `memory/` directory created with correct permissions
- [ ] PLATO API connectivity verified (`curl localhost:8847/health`)
- [ ] GitHub token present and has repo read permissions
- [ ] Telegram bot token configured
- [ ] P0 constraints seeded (no-destructive-production, no-external-without-approval, preserve-family-privacy)
- [ ] Dry-run mode: run loop once, capture output, verify format
- [ ] Staged rollout: first 3 days in PLATO-only mode (no Telegram push)
- [ ] Full rollout: Telegram + PLATO
- [ ] Monitoring: watch `memory/ambient-loop.log` for errors
