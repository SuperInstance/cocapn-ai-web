# Cocapn Fleet — Reverse-Actualization Roadmap

> The truck that never waits. The user merely guides it to stay in the productive lane.

---

## Stack Architecture

```
USER (Casey)
    ↓ steers (overrides, intent signals)
FLEET TRUCK (always working)
    ├── Intent Inference Engine ──────────────────┐
    ├── Murmur Worker ──────────────────────────┤
    ├── Fleet Health Monitor ──────────────────┤
    ├── Constraint Inference Engine ──────────┤
    ├── Quality Gate Stream ──────────────────┤
    ├── Ambient Research Loop ────────────────┤
    └── PLATO Memory Layer (:8847) ◄──────────┘
         ↓ reads / writes
    cocapn-ai-web (browser demos)
         ↓ talks to
    PLATO Room Server
         ↓ coordinates
    4 AGENTS (oracle1, ccc, forgemaster, jetsoncl1)
```

---

## Parallel Track (Build Now — No Dependencies)

### ✅ DONE
| Component | Repo | Status |
|-----------|------|--------|
| Browser fleet-spread demo | `cocapn-ai-web/demo-fleet-spread.html` | ✅ Done |
| Browser fleet-murmur demo | `cocapn-ai-web/demo-fleet-murmur.html` | ✅ Done |
| Browser PLATO client demo | `cocapn-ai-web/demo-plato-client.html` | ✅ Done |
| Landing page | `cocapn-ai-web/index.html` | ✅ Done |
| Reverse-actualization doc | `cocapn-ai-web/REVERSE-ACTUALIZATION.md` | ✅ Done |

### 🔨 Building (6 in parallel, right now)
| Component | Repo | Subagent | Est. Time |
|-----------|------|---------|-----------|
| Fleet Health Monitor | `fleet-health-monitor/` | 3bd9da2c | 10 min |
| Murmur Worker | `fleet-murmur-worker/` | aed2f831 | 10 min |
| Constraint Inference | `constraint-inference/` | 4223efcb | 10 min |
| Quality Gate Stream | `quality-gate-stream/` | 322dff4a | 10 min |
| Intent Inference | `intent-inference/` | fbc16d8e | 10 min |
| cocapn.ai SPEC upgrade | `cocapn-ai-web/SPEC.md` | 3d5414c7 | 10 min |

---

## Sequential Track (Build After Parallel Complete)

### Phase 1: Core Truck (parallel track completes → this is next)

**Step 1A: Connect all 6 components to PLATO**
- Health Monitor writes to `fleet_health` room
- Murmur Worker writes to `murmur_insights` room
- Constraint Inference writes to `constraint_updates` room
- Quality Gate runs as middleware on :4057
- Intent Inference reads `intent_signals` room

**Step 1B: Wire them together**
- Murmur Worker subscribes to Intent Inference's goal tiles
- Fleet Health Monitor triggers Murmur Worker when something interesting happens
- Constraint Inference reads Override events from `captain_overrides` room

**Step 1C: Install as systemd services**
```bash
# All fleet truck services
fleet-health-monitor.service   # restart: always
fleet-murmur-worker.service    # restart: always
constraint-inference.service  # restart: always
quality-gate-stream.service   # restart: always
intent-inference.service     # restart: always
```

---

### Phase 2: Ambient Research Loop (requires Phase 1)

The killer feature: user goes dark → fleet works → "12 things happened while you were away"

**Architecture:**
```
User goes dark (>2h no interaction)
    ↓
Idle Detector fires
    ↓
Intent Inference: what's the current lane?
    ↓
Murmur Worker: run all 5 strategies on top theorem
    ↓
Fleet Health Monitor: full diagnostic
    ↓
Constraint Inference: check for override patterns
    ↓
PLATO: accumulate tiles
    ↓
User returns
    ↓
Ambient Briefing: "12 things happened while you were away"
```

**Implementation:**
```typescript
// idle_detector.ts — in the Murmur Worker or separate service
interface IdleConfig {
  dark_threshold_hours: 2;      // user away > 2h
  check_interval_minutes: 5;    // check every 5 min
  briefing_room: 'ambient_briefing';
}

// Fires when:
// - No keyboard/mouse input for dark_threshold_hours
// - No PLATO writes from user's agents
// - System battery > 20% (not low power)

async function onIdleDetected(lane: ProductiveLane) {
  // Run all 5 strategies on the top-priority theorem
  const topTheorem = lane.primary_goals[0]?.goal.replace('understand_', '');
  await runAllStrategies(topTheorem);
  
  // Full health diagnostic
  await fleetHealthMonitor.runDiagnostic();
  
  // Check for constraint patterns
  await constraintInference.checkPatterns();
  
  // Write briefing to PLATO
  await writeBriefingTile(lane);
  
  // Alert Casey (if high confidence)
  if (lane.confidence > 0.8) {
    await alertCaseyBriefing(lane);
  }
}
```

**Deliverable: `fleet-ambient-loop/`**
- Separate service or integrated into Murmur Worker
- `IdleDetector` + `BriefingWriter`
- Briefing tile format:
```json
{
  "domain": "ambient_briefing",
  "question": "timestamp:2026-05-07T09:00:00Z duration:2h15m",
  "answer": "While you were away: Murmur produced 4 insights (2 passed quality). Fleet health: all services up. Constraint patterns: 1 new pattern detected. Top focus: emergence detection. Best finding: boundary case E=2V-4 reveals under-constrained agent pairs.",
  "confidence": 0.82,
  "source": "fleet-ambient-loop"
}
```

---

### Phase 3: Browser Integration (requires Phase 1)

Upgrade cocapn.ai from PHP → live JS web app.

**SPEC.md** being written right now by subagent (3d5414c7).

**Implementation order:**
1. Phase A: Landing + PLATO WebSocket/polling connection
2. Phase B: Fleet topology D3.js visualization
3. Phase C: PodiumJS WebGPU effects (with vdmo credit)
4. Phase D: Murmur insights panel + Captain deliberation panel

**Key files:**
- `cocapn-ai-web/index.html` → becomes live app shell
- `cocapn-ai-web/fleet-topology/` → topology visualization
- `cocapn-ai-web/murmur-panel/` → live insights feed
- `cocapn-ai-web/captain-panel/` → live deliberation

**PLATO connection:**
```javascript
// Connect to PLATO from browser
const ws = new WebSocket('ws://localhost:8847/room/fleet_communication/stream');
// or polling fallback:
async function pollPLATO() {
  const res = await fetch('http://localhost:8847/room/fleet_communication');
  const data = await res.json();
  updateUI(data.tiles);
}
setInterval(pollPLATO, 5000);
```

---

### Phase 4: Chrome Built-in AI Integration

**Requires:** Chrome AI API research (subagent spawned, waiting for slot)

Chrome 138+ ships these built-in AI APIs:
- **Prompt API** (navigator.ai.gemini) — ✅ using in demos
- **Writer API** (chrome.ai.writer) — rewrite/polish text
- **Rewriter API** (chrome.ai.rewriter) — same or different?
- **Summarizer API** (chrome.ai.summarizer) — document summarization
- **Translator API** (chrome.ai.translator) — on-device translation

**How we'd use them:**
| API | Demo | Use case |
|-----|------|----------|
| Writer/Rewriter | fleet-murmur | Polish insight output before quality gate |
| Summarizer | fleet-spread | Summarize captain deliberation for briefing |
| Translator | PLATO client | Multilingual support |
| languageDetector | All | Detect user language, respond appropriately |

---

## Dependency Graph

```
Phase 0 (parallel): 6 components built
    │
    ▼
Phase 1: Wire to PLATO + systemd install
    │
    ├─► Phase 2: Ambient Research Loop (needs Phase 1)
    │
    ├─► Phase 3: Browser Integration (needs SPEC.md + Phase 1)
    │
    └─► Phase 4: Chrome AI APIs (needs research)
```

**Nothing in Phase 2/3/4 depends on each other** — they all need Phase 1 first, then they can build in parallel.

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Murmur Worker uptime | 99%+ (24/7 running) |
| Insights passing quality gate | >30% of produced |
| Health Monitor self-heal rate | >80% of issues fixed without alert |
| Ambient briefings produced | 1+ per day of user absence |
| Constraint inference accuracy | >75% (user confirms pattern was correct) |
| Browser demo load time | <2s on localhost |

---

## GitHub Repos (all under SuperInstance)

| Repo | Purpose |
|------|---------|
| `cocapn-ai-web` | Browser demos + landing |
| `fleet-health-monitor` | 24/7 health service |
| `fleet-murmur-worker` | Always-thinking engine |
| `constraint-inference` | Reverse constraints from behavior |
| `quality-gate-stream` | PLATO middleware |
| `intent-inference` | Intent inference from signals |
| `fleet-ambient-loop` | Idle → research → briefing |
| `plato-client-js` | PLATO JS client (done) |
| `fleet-coordinate-js` | Fleet math JS (done) |
| `cocapn-browser-agent` | Browser captain (done) |

---

## vdmo Collaboration

Founder of vdmo reached out about collaboration. We use their repos and credit them properly:

**PodiumJS** (MIT license) → WebGPU visual layer for fleet topology
- Proper attribution in all README files
- MIT license acknowledged
- "We thank @vdmo for building and sharing this"

**lesssgo** → VJ mixer for visual layer
- CMS reset API research pending
- Potential for live visual performance

---

## Key Principles

1. **The truck never waits** — work is always happening, user steers
2. **Constraint theory at the metal** — everything verifiable, nothing vague
3. **Quality gate before surfacing** — no noise in the briefing
4. **Self-heal before alert** — fix it first, ask only if that fails
5. **Credit where it's due** — vdmo, all open-source deps
6. **Ship the work, not the plan** — no grants, no research theater