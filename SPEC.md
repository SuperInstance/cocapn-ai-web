# CoCapn AI Web — v2 Spec
## Upgrading from PHP to a Live JavaScript SPA with WebGPU Visualization

**Spec Version:** 1.0  
**Date:** 2026-05-07  
**Author:** Oracle1 (subagent research task)  
**Status:** Draft for Casey review

---

## 1. Why a Pure JS SPA Beats the PHP Version

### Current Pain Points (from live PHP code review)

| PHP Problem | JS SPA Fix |
|---|---|
| Page reloads to fetch fresh PLATO data | Live WebSocket/polling connection to PLATO room server |
| Stats update every 10s via crude JS intervals | Real-time event-driven updates from :8847 |
| SVG radar is static CSS animation, no interactivity | WebGPU-powered radar with actual data-linked animations |
| Fleet topology is a hardcoded SVG with fixed positions | D3.js force-directed graph with live agent state |
| Explorer needs full page reload to switch rooms | Single-page tab switching, room data fetched per-request |
| No concept of "live tile feed" | Polling :8847 every 5s, new tiles animate in |
| PHP server must be co-located with PLATO client | Pure client-side, connects to any PLATO host |

### Core Wins

1. **Live PLATO stream** — connect directly to `localhost:8847` room server. No PHP intermediary. Tiles stream in real-time.
2. **WebGPU radar hero** — replacing the CSS-animated SVG with a PodiumJS canvas. Rings expand outward at real fleet pulse rate. Agent pings correspond to actual `last_seen` timestamps.
3. **Real-time fleet topology** — D3.js force-directed graph showing agents as nodes, trust edges as lines. Color-coded by health. Updates live.
4. **No build step** — CDN-hosted ES modules. Drop a single `index.html` + `app/` folder on any static host.
5. **Murmur insights live** — quality-gated tiles appear in real-time from the `murmur_insights` room.

---

## 2. Architecture

### Module Structure

```
cocapn-ai-web/
├── index.html                    # Entry point (no build step)
├── app/
│   ├── main.js                   # App init, router, global state
│   ├── styles/
│   │   └── base.css              # Dark theme, CSS variables (from existing style.css)
│   ├── components/
│   │   ├── RadarCanvas.js         # PodiumJS WebGPU radar hero
│   │   ├── FleetTopology.js       # D3.js force-directed graph
│   │   ├── TileFeed.js            # Live PLATO tile feed
│   │   ├── CaptainPanel.js        # Live captain reasoning stream
│   │   └── StatsBar.js            # Real-time fleet stats
│   ├── services/
│   │   ├── plato-client.js        # PLATO room server client (:8847)
│   │   ├── fleet-state.js         # In-memory fleet state management
│   │   └── event-bus.js           # Lightweight pub/sub for components
│   └── lib/
│       └── config.js              # PLATO endpoints, CDN URLs, config constants
├── SPEC.md                       # This file
└── README.md                      # Dev instructions
```

### How It Connects to PLATO at :8847

```javascript
// Direct HTTP polling every 5s (no WebSocket needed — HTTP is fine for this scale)
const PLATO_BASE = 'http://localhost:8847';

// Rooms we subscribe to:
const ROOMS = [
  'oracle1_infrastructure',  // Oracle1's operational state
  'fleet_communication',     // Inter-agent messages
  'fleet_health',           // Agent health + trust scores
  'murmur_insights',        // Quality-gated insights from the fleet
];

// Tile feed polling
async function pollTiles(room, since = null) {
  const url = `${PLATO_BASE}/room/${room}/tiles${since ? `?since=${since}` : ''}`;
  const res = await fetch(url);
  return res.json(); // [{id, content, timestamp, tags, quality_score, ...}]
}
```

### CDN Dependencies (Minimal)

```html
<!-- Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@300;400;600;700&display=swap">

<!-- D3.js for graph rendering -->
<script src="https://cdn.jsdelivr.net/npm/d3@7/+esm" type="module"></script>

<!-- PodiumJS from npm CDN -->
<script type="module">
  import { Podium } from 'https://unpkg.com/podiumjs@latest/dist/podium.esm.js';
</script>
```

**No React. No Vue. No Webpack. No build step.** Vanilla JS + ES modules from CDN.

---

## 3. WebGPU Visual Layer (PodiumJS)

### About PodiumJS

PodiumJS (by [@vdmo](https://github.com/vdmo)) is a modern WebGPU-based alternative to Curtains.js for creating interactive planes and stunning visual effects.

**Key APIs:**
- `new Podium({ canvas, backgroundColor, autoResize })` — init with a canvas element
- `await podium.initialize()` — init WebGPU context
- `await podium.createPlane(id, imageUrl, { width, height })` — textured plane
- `await podium.createUniformPlane(id, imageUrl)` — plane with custom uniform support
- `podium.setTransform(id, { position, scale, rotation })` — update object transform
- `podium.updateUniforms(id, { customValue, mousePosition })` — update shader uniforms
- `podium.startRenderLoop()` / `podium.stopRenderLoop()` — control render loop

**Use for cocapn.ai:** Radar rings, agent glow effects, particle drift visualization. NOT for the full fleet topology (D3.js handles that better).

**License:** MIT (per vdmo/podiumjs-rocks repo)

**Links:**
- npm: https://www.npmjs.com/package/podiumjs
- GitHub: https://github.com/vdmo/podiumjs-rocks

### Radar Ring Animation (Hero Visual)

The existing hero has a CSS-animated SVG radar. We replace it with a PodiumJS canvas:

```javascript
import { Podium } from 'https://unpkg.com/podiumjs@latest/dist/podium.esm.js';

const canvas = document.getElementById('radar-canvas');
const podium = new Podium({ canvas, backgroundColor: [0.04, 0.055, 0.09, 1.0], autoResize: true });
await podium.initialize();

// Create radar ring planes (expanding rings emanating from center)
// Each ring is a texture rendered as a circle with alpha fade
await podium.createUniformPlane('ring1', 'data:image/png;base64,...'); // pre-rendered ring texture

// Animate rings expanding outward — transform driven by JS timer
function animateRadar(timestamp) {
  const phase = (timestamp % 4000) / 4000; // 4s cycle
  const ringScale = 0.5 + phase * 1.5;
  const ringOpacity = 1.0 - phase;
  podium.updateUniforms('ring1', { scale: ringScale, opacity: ringOpacity, time: phase });
  requestAnimationFrame(animateRadar);
}
podium.startRenderLoop();
```

### Fleet Topology (D3.js — NOT WebGPU)

Fleet topology is an interactive force-directed graph. D3.js handles this better than raw WebGPU because:
- SVG/Canvas hybrid for crisp labels and interaction
- Built-in force simulation (charge, link distance, collision)
- Easy event handling (hover, click, drag)

```javascript
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Nodes: agents (Oracle1, JetsonClaw1, Forgemaster, CCC)
// Edges: trust connections with weight = trust score
// Color: health (green=healthy, yellow=degraded, red=failed)
// Size: uptime or activity level
```

### Agent Pings (PodiumJS Particles)

```javascript
// Agent pings as small glowing dots that appear and fade
// Each agent has a "ping event" when they submit a tile or send a message
// PodiumJS particle system for the ping effect

podium.updateUniforms('pingParticle', {
  position: [agent.x, agent.y, 0],
  intensity: pingStrength,
  decay: pingDecay,
  color: agentColor, // keeper=yellow, edge=green, etc.
});
```

### Particle Drift (Trust Values Flowing Through Network)

Trust values as small particles drifting along edges between agents. Visual metaphor for knowledge propagation.

---

## 4. Live PLATO Integration

### Rooms to Subscribe To

```javascript
const PLATO_ROOMS = {
  oracle1_infrastructure: {
    description: 'Oracle1 operational state, architecture decisions',
    pollInterval: 5000,
  },
  fleet_communication: {
    description: 'Inter-agent message bus, tile submissions',
    pollInterval: 3000, // higher frequency
  },
  fleet_health: {
    description: 'Agent health, uptime, last_seen, trust scores',
    pollInterval: 5000,
  },
  murmur_insights: {
    description: 'Quality-gated insights (quality_score >= threshold)',
    pollInterval: 10000,
  },
};
```

### Tile Feed (Polling Every 5s)

```javascript
class TileFeed {
  constructor(containerEl) {
    this.container = containerEl;
    this.lastTileId = null;
    this.interval = 5000;
  }

  async poll() {
    const tiles = await fetch(`${PLATO_BASE}/room/fleet_communication/tiles`).then(r => r.json());
    const newTiles = tiles.filter(t => t.id > this.lastTileId);
    newTiles.forEach(t => this.injectTile(t));
    this.lastTileId = tiles[0]?.id || this.lastTileId;
  }

  injectTile(tile) {
    const el = document.createElement('div');
    el.className = 'tile-item';
    el.innerHTML = `<div class="tile-meta"><span class="mono">#${tile.id}</span></div><div class="tile-content">${tile.content || tile.question || ''}</div>`;
    el.style.animation = 'fadeSlideIn 0.4s ease-out';
    this.container.prepend(el);
    // Keep only last 50 tiles in DOM
    while (this.container.children.length > 50) this.container.lastChild.remove();
  }

  start() { setInterval(() => this.poll(), this.interval); }
}
```

### Live Captain Decisions

PLATO `oracle1_infrastructure` room contains architecture decisions, captain reasoning. Poll for new tiles and display in the Captain Panel.

---

## 5. Pages / Sections

### Home / Dashboard

- **Hero:** WebGPU radar canvas (PodiumJS), lighthouse center, expanding rings, agent pings
- **Stats bar:** Live counts — PLATO rooms, constraint tiles, fleet agents
- **Fleet cards:** Same as current PHP, but status updates live without page reload
- **PLATO nervous system section:** Explains constraint propagation
- **CTA:** "Start the $10K Pilot" → link to certify product

### Fleet Topology

- **Full-page D3.js force-directed graph**
- Nodes: agents (Oracle1=Keeper, JetsonClaw1=Edge, Forgemaster=Foundry, CCC=Public)
- Edges: trust connections, weighted by trust_score from `fleet_health` room
- Node colors: green (healthy), yellow (degraded), red (failed), gray (offline)
- Hover: show agent details, uptime, last_seen
- Click: expand to show agent's recent tiles
- Controls: zoom, pan, filter by health status

### Murmur Insights

- **Live feed** from `murmur_insights` room
- Quality gate: only show tiles with `quality_score >= 0.7`
- Each tile shows: content, source agent, timestamp, tags
- Real-time injection with slide-in animation
- Filter by tag

### Captain Deliberation

- **Live stream** of captain (Oracle1) reasoning
- Polls `oracle1_infrastructure` for architecture decision tiles
- Shows decision context + rationale in real-time
- Distinguishes "decisions made" vs "deliberation in progress"

### Docs

- Simple page with links to fleet documentation
- Links out to: FLUX Certify docs, PLATO protocol docs, GitHub repos

---

## 6. CDN Dependencies (Minimal)

```html
<!-- Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Inter:wght@300;400;600;700&display=swap">

<!-- D3.js -->
<script src="https://cdn.jsdelivr.net/npm/d3@7/+esm" type="module"></script>

<!-- PodiumJS (npm CDN) -->
<script type="module">
  import { Podium } from 'https://unpkg.com/podiumjs@latest/dist/podium.esm.js';
  // Or from jsdelivr:
  // import { Podium } from 'https://cdn.jsdelivr.net/npm/podiumjs@latest/dist/podium.esm.js';
</script>
```

---

## 7. Implementation Plan

### Phase A: Landing + PLATO Connection (1-2 days)
- Set up `index.html` shell with CSS variables from existing style.css
- Implement `plato-client.js` — HTTP client for :8847 room server
- Build `StatsBar` component — live counts from PLATO
- Port hero section (static SVG radar first, WebGPU later in Phase C)
- Deploy and verify: page loads, PLATO data streams in

### Phase B: Fleet Topology + D3.js (2-3 days)
- Build `FleetTopology.js` — D3.js force-directed graph
- Connect to `fleet_health` room for live agent state
- Node coloring by health, edge weights by trust score
- Hover + click interactions
- Deploy and verify: topology renders, updates live

### Phase C: WebGPU Effects via PodiumJS (2-3 days)
- Replace hero SVG radar with PodiumJS canvas
- Implement expanding ring animation (radar sweep)
- Add agent ping particles
- Add particle drift (trust values flowing along edges)
- WebGPU fallback: if WebGPU unavailable, show high-quality Canvas2D fallback
- Deploy and verify: radar animates smoothly, pings appear on agent activity

### Phase D: Murmur Insights + Captain Panel (1-2 days)
- Implement `TileFeed.js` for `murmur_insights` room
- Quality gate filtering (quality_score >= threshold)
- Implement `CaptainPanel.js` for live deliberation stream
- Real-time tile injection with animations
- Deploy and verify: insights appear live, captain panel shows reasoning

---

## 8. vdmo Collaboration Note

**PodiumJS** is created and maintained by [@vdmo](https://github.com/vdmo) (GitHub).

**Repository:** https://github.com/vdmo/podiumjs-rocks  
**npm:** https://www.npmjs.com/package/podiumjs (note: this package name may be contested — verify ownership before publishing any fork)  
**License:** MIT

**Collaboration opportunity:**  
The cocapn.ai WebGPU visualizations (radar rings, agent pings, particle drift) are a natural showcase for PodiumJS capabilities. We'd love to:
1. Give vdmo credit as the WebGPU foundation for cocapn.ai
2. Share performance notes / feature requests back to vdmo's repo
3. Potentially co-author a case study: "WebGPU for fleet monitoring dashboards"
4. If vdmo wants a demo partner for the podiumjs-rocks README, cocapn.ai's fleet topology would be an excellent showcase

**Suggested acknowledgment in UI footer:**  
`WebGPU radar powered by [PodiumJS](https://github.com/vdmo/podiumjs-rocks) by @vdmo — MIT License`

---

## 9. Research Sources

### PodiumJS
- GitHub: https://github.com/vdmo/podiumjs-rocks
- npm: npm view podiumjs (fetch blocked, repo confirmed)
- API: Podium class, createPlane, createUniformPlane, setTransform, updateUniforms, render loop
- Capabilities: WebGPU texturing, uniforms, transforms, auto-resize, TypeScript

### lesssgo (vdmo's VJ mixer)
- GitHub: https://github.com/vdmo/lesssgo
- "my attempt to build super light VJ mixer in browser — so lesssgo!"
- CMS reset API: not found in public docs (requires deeper dig into lesssgo repo)
- Interface with PodiumJS: likely — VJ mixer likely uses PodiumJS for visual effects

### cocapn.ai current state (PHP)
- `index.php` — Landing page, fleet cards, stats bar, CSS-animated SVG radar
- `style.css` — Dark theme, CSS vars, Space Mono + Inter fonts, radar animations
- `fleet.php` — Fleet registry table + SVG beacon map with agent positions
- `explorer.php` — Room browser, tile viewer, tile submission form

### CSS Variables to Preserve (from style.css)
```css
--bg: #0a0e17;
--surface: #111827;
--surface2: #1a2235;
--border: #1e293b;
--text: #e2e8f0;
--muted: #64748b;
--accent: #3b82f6;
--accent-glow: rgba(59,130,246,0.25);
--keeper: #f59e0b;
--keeper-glow: rgba(245,158,11,0.25);
--edge: #10b981;
--edge-glow: rgba(16,185,129,0.25);
--success: #22c55e;
--danger: #ef4444;
--warning: #eab308;
```

---

## 10. Open Questions

1. **PLATO room server API** — exact endpoint shapes for polling tiles (does `/room/{name}/tiles` return array? What fields per tile?)
2. **WebGPU fallback** — what's the graceful degradation if Chrome < 113 or Safari no WebGPU? Canvas2D fallback?
3. **lesssgo CMS reset API** — not enough info from public repo. Need to dig deeper or ask vdmo directly.
4. **PodiumJS npm availability** — npm view returned blocked. Need to verify actual package exists and is importable from CDN.
5. **Authentication** — does PLATO room server require any auth? Currently seems open (localhost).

---

*Spec by Oracle1 subagent, 2026-05-07. Ready for Casey review and kimi-cli implementation.*