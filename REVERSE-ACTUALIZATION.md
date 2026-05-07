# Reverse-Actualization Engineering + Ambient Truck Assistant

## Core Concept

Classic AI assistant: **user asks → assistant answers** (reactive)

Truck assistant: **assistant always working → user steers it away from unproductive tangents** (perpetual + directional)

The user is the **load being transported**, not the driver. The truck doesn't wait at the depot for instructions — it runs continuous routes, and the user just ensures it stays on the productive route.

**Reverse-actualization**: Instead of "actualize the user's stated intent" (prompt engineering), the system **observes what the user actually does** and reverse-engineers their implicit goal, then works toward that goal continuously. When the user drifts off-task, the truck steers them back — not by nagging, but by doing the work they were trying to do.

---

## The Truck Stack — How It Maps to Our Fleet

### 1. Murmur as Ambient Thinking Layer

**What it does**: The 5 thinking strategies (explore, connect, contradict, synthesize, question) run continuously in a background web worker, not triggered by user prompts. The quality gate filters. High-quality insights surface to the user when they open the browser tab.

**How it feels**: You open `cocapn.ai/murmur` and there's already a backlog — "Explorer produced 12 insights while you were away, 3 passed quality gate." Not a blank prompt waiting for your input. The mind was working.

**Reverse-actualization angle**: Most thinking tools make you initiate. This makes thinking **happen** and you just tune in.

```
User away → Murmur runs in background (web worker)
             ↓ quality gate (novelty × correctness × completeness × depth ≥ 0.35)
             ↓ passing insights written to PLATO "murmur_insights" room
User returns → sees accumulated thinking, not blank slate
```

### 2. Spread (Captain) as Perpetual Deliberation

**What it does**: The captain's deliberation loop (is stable? → consult specialists → apply P0 constraints → decide) runs on a timer. Every 30 seconds, the fleet graph is re-evaluated. The decision is pre-reasoned before the user asks.

**How it feels**: You ask "should we rebalance trust edges?" The captain says "already decided — stable, no action needed, reasoned 47 times in the last hour." The deliberation is **already done**.

**Reverse-actualization angle**: Most tools wait for the question. The captain was already answering it.

```
Fleet graph state changes → trigger deliberation
                           → stored in PLATO "captain_decisions" room
User asks → response is pre-computed, surfaced from memory
```

### 3. PLATO as Working Memory (Not Queryable Database)

**What it does**: Tiles are being written constantly. The user sees the stream, not a database. The agent is the primary writer. The user is a reader who occasionally contributes.

**How it feels**: The agent is writing its memory out loud. You can read it anytime. The agent's mind is visible, not hidden behind a prompt box.

**Reverse-actualization angle**: Classic memory = "user writes, system stores." Flip it — **system writes, user reads**.

### 4. Constraint Theory as Invisible Validation Layer

**What it does**: FLUX-C bytecode runs in a web worker, constantly validating decisions against the GUARD constraints (safety margins, spares, trust thresholds, emergence ceiling, ZHC tolerance, time windows). The user never explicitly calls it — it's just always running on every decision.

**How it feels**: Decisions that violate P0 constraints are flagged before you see them. You're not thinking about constraints — they're just enforced.

---

## Reverse-Actualization Engineering — Technical

### Definition
Reverse-actualization = the system observes actual user behavior (clicks, navigation, text input, time on task) and infers the implicit goal, then works toward that goal in the background while the user drifts.

### Inputs the system observes
- What pages/sections the user spends time on
- What they ignore (open and don't engage)
- What they type then delete
- How they respond to captain decisions (confirm, override, ignore)
- Which murmur insights they expand vs skip
- Time of day patterns (morning vs late night)

### What the system produces
- A **productive lane model** — the set of tasks/contexts where the user is most effective
- **Steer signals** — when to surface work, when to stay quiet
- **Inverse prompting** — instead of "what do you want to do?" it says "based on what you've been doing, here's what's ready"

### The Steering Mechanism
Not a notification or interrupt. The system works on things the user was likely trying to do, and when they return, the work is done or in progress. The steer is **ambient completion** — not nagging, just having done the work.

```
User types "I should really look at the emergence detection..." (then switches tabs)
        ↓ system observes intent signal (text, navigation away)
        ↓ reverse-engineers: user wants to understand emergence in their fleet
        ↓ Murmur runs H1 emergence strategy in background
        ↓ PLATO tile written: { type: 'user_intent', inferred_goal: 'understand_emergence' }
        ↓ Murmur explores H1 theorem, quality gate, surfaces result
User returns → "I ran the H1 exploration while you were away — 3 insights passed quality"
```

---

## User Experience: The "Truck" Feel

### First Visit (New User)
Landing page: "This fleet runs itself. You steer." — shows live captain deliberation, murmur insights ticking in, constraint validation happening. Zero setup. Just works in Chrome.

### Returning User
- PLATO timeline shows what the fleet worked on while they were away
- Murmur insights accumulated (quality-gated)
- Captain decisions pre-reasoned
- "You were trying to understand [X] — here's what the fleet found"

### Steering the Truck
- **Feed forward intent** — type what you're trying to accomplish, the system works toward it
- **Override captain decisions** — signal that the productive lane has shifted
- **Silence a thread** — tell the system "this isn't my lane" and it deprioritizes
- **Drift detection** — system notices you're browsing things unrelated to your lane, stays quiet

---

## Technical Implementation Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    CHROME (Browser)                         │
│                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Murmur      │  │ Captain     │  │ FLUX-C Web Worker   │ │
│  │ Web Worker  │  │ Deliberation│  │ (Constraint Checker) │ │
│  │ (5 strat.)  │  │ (30s timer) │  │ (always running)     │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                    │             │
│         └────────┬────────┴───────────────────┘             │
│                  ↓                                          │
│         ┌─────────────────┐                                 │
│         │ PLATO Room      │  ← All tiles written here      │
│         │ (local storage) │    (also sync to server)       │
│         └────────┬────────┘                                 │
│                  ↓                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    UI Layer                          │  │
│  │  Murmur Panel  │  Captain Panel  │  Timeline         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Gemini Nano (Prompt API) — navigator.ai.gemini       │  │
│  │ OR Cloud fallback (DeepSeek/z.ai)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Quality Gate — What Gets Surfaced

Murmur produces insights. Quality gate (0.35 threshold) determines what surfaces:

| Score | Quality | Action |
|-------|---------|--------|
| ≥ 0.6 | High | Surface immediately + notify |
| 0.35–0.6 | Medium | Surface in timeline, don't interrupt |
| < 0.35 | Low | Discard, log reason |

Novelty × Correctness × Completeness × Depth

**Novelty**: Is this just restating the theorem? Or does it cross-pollinate?
**Correctness**: Mathematically self-consistent?
**Completeness**: Does it answer the theorem's core question?
**Depth**: Does it reveal something non-obvious?

---

## The 5 Strategies (Technical Reference)

### EXPLORE — "What does this imply that isn't obvious?"
- Extract formal implications from the theorem statement
- Check what happens at boundary conditions (E = 2V - 4, E = 2V - 2)
- Look for 2D vs 3D assumptions, generic vs specific configurations

### CONNECT — "How does this relate to others?"
- Laman ↔ H¹: rigidity condition (E=2V-3) ⟺ β₁=V-2 for C=1
- ZHC ↔ Pythagorean48: flat connection → product of trust transformations = identity
- H¹ ↔ emergence: β₁ > V-2 (rigid) or > V-1 (non-rigid) = emergence detected

### CONTRADICT — "When does this fail?"
- Counterexamples at boundary conditions
- Assumptions that don't hold in real fleets (uniform degree, planar graphs)
- What happens when the fleet is NOT Laman-rigid

### SYNTHESIZE — "What unifies multiple theorems?"
- The unified insight: all fleet coordination reduces to **constraint satisfaction on a rigidity graph**
- Laman = rigidity constraint. H¹ = cycle constraint. ZHC = flatness constraint.
- Three faces of the same geometric truth

### QUESTION — "What doesn't this answer?"
- Does Laman tell us anything about 3D rigidity?
- Does H¹ tell us anything about trust convergence speed?
- Does ZHC tell us anything about adversarial agents?

---

## Reference: Full Fleet Stack (Rust → Browser)

| Rust Crate | Browser Equivalent | Status |
|-----------|-------------------|--------|
| `fleet-coordinate` | `fleet-coordinate.js` (inline) | ✅ Built |
| `fleet-spread` (captain) | `demo-fleet-spread.html` | 🔨 Building |
| `fleet-murmur` (strategies) | `demo-fleet-murmur.html` | 🔨 Building |
| `plato-client` | `@cocapn/plato-client` | ✅ Built |
| `constraint-theory` (FLUX-C) | `flux-sandbox.js` (existing) | ✅ Existing |
| `holonomy-consensus` | JS port (simplified) | ✅ Built |

---

## v0.1 — What Ships

1. **`demo-fleet-spread.html`** — Captain deliberation in browser, pre-loaded scenarios
2. **`demo-fleet-murmur.html`** — 5 strategies on theorems, quality gate, live results
3. **PLATO browser demo** — Room protocol visualized, tile submission live
4. **Chrome built-in AI indicator** — "🤖 Gemini Nano: Available" badge
5. **Background web workers** — Murmur + constraint checker always running

All open in Chrome. Zero install. Zero API keys for the AI layer (when Gemini Nano available).