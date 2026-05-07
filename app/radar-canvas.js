/**
 * PodiumJS WebGPU Radar Renderer
 * Replaces the CSS-animated SVG radar with a real WebGPU canvas.
 * Falls back gracefully to the CSS radar if WebGPU is unavailable.
 */

import { Podium } from 'https://cdn.jsdelivr.net/npm/podiumjs@latest/dist/podium.esm.js';

let podium = null;
let animationId = null;

// Agent ping definitions (match existing CSS radar positions)
const AGENTS = [
  { id: 'oracle1', x: 0.5, y: 0.5, color: [0.96, 0.62, 0.04], label: 'Oracle1' },    // keeper amber
  { id: 'jc1',     x: 0.60, y: 0.25, color: [0.06, 0.73, 0.51], label: 'JetsonClaw1' }, // edge green
  { id: 'fm',      x: 0.35, y: 0.65, color: [0.66, 0.33, 0.97], label: 'Forgemaster' },  // purple
  { id: 'ccc',     x: 0.72, y: 0.40, color: [0.23, 0.51, 0.96], label: 'CCC' }         // accent blue
];

// Ring stagger offsets (as fraction of cycle)
const RING_STAGGER = [0, 0.33, 0.66];
const RING_LIFETIME = 3.0; // seconds per ring cycle
const SWEEP_SPEED = 1.0;    // rotations per second

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export async function initRadar(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  // --- WebGPU availability check ---
  if (!canvas.getContext('webgpu')) {
    // Hide webgpu container, show CSS fallback
    document.getElementById('webgpu-radar').style.display = 'none';
    const cssRadar = document.querySelector('.css-radar');
    if (cssRadar) cssRadar.style.display = 'block';
    console.info('[radar] WebGPU unavailable — CSS fallback active');
    return;
  }

  // --- Init PodiumJS ---
  try {
    podium = new Podium({
      canvas,
      backgroundColor: [0.04, 0.055, 0.09, 1.0],  // #0a0e17 matching page bg
      autoResize: true
    });
    await podium.initialize();
  } catch (err) {
    console.warn('[radar] PodiumJS init failed, falling back:', err);
    document.getElementById('webgpu-radar').style.display = 'none';
    const cssRadar = document.querySelector('.css-radar');
    if (cssRadar) cssRadar.style.display = 'block';
    return;
  }

  // --- Create lighthouse center ---
  // Simple glowing circle via shader uniforms — no texture needed
  await podium.createUniformPlane('lighthouse', null, {
    width: 0.12,
    height: 0.12,
    uniforms: {
      uColor:     { type: 'float4', value: [0.96, 0.62, 0.04, 1.0] },
      uGlow:      { type: 'float',  value: 1.0 },
      uOpacity:   { type: 'float',  value: 0.9 },
      uAspect:    { type: 'float',  value: 1.0 },
      uTime:      { type: 'float',  value: 0.0 }
    }
  });

  // --- Create 3 expanding rings ---
  for (let i = 0; i < 3; i++) {
    await podium.createUniformPlane(`ring${i}`, null, {
      width: 2.0,
      height: 2.0,
      uniforms: {
        uColor:    { type: 'float4', value: [0.23, 0.51, 0.96, 1.0] },
        uScale:    { type: 'float',  value: 0.0 },
        uOpacity:  { type: 'float',  value: 0.0 },
        uRing:     { type: 'float',  value: i },
        uAspect:   { type: 'float',  value: 1.0 },
        uTime:     { type: 'float',  value: 0.0 }
      }
    });
  }

  // --- Create sweep plane ---
  await podium.createUniformPlane('sweep', null, {
    width: 2.0,
    height: 2.0,
    uniforms: {
      uColor:   { type: 'float4', value: [0.23, 0.51, 0.96, 0.6] },
      uAngle:   { type: 'float',  value: 0.0 },
      uOpacity: { type: 'float',  value: 0.7 },
      uAspect:  { type: 'float',  value: 1.0 },
      uTime:    { type: 'float',  value: 0.0 }
    }
  });

  // --- Create agent ping planes ---
  for (const agent of AGENTS) {
    await podium.createUniformPlane(`ping_${agent.id}`, null, {
      width: 0.06,
      height: 0.06,
      uniforms: {
        uColor:     { type: 'float4', value: [...agent.color, 1.0] },
        uIntensity: { type: 'float',  value: 1.0 },
        uPulse:     { type: 'float',  value: 0.0 },
        uAspect:    { type: 'float',  value: 1.0 },
        uTime:      { type: 'float',  value: 0.0 }
      }
    });
  }

  // --- Start render loop ---
  podium.startRenderLoop();
  let startTime = performance.now();

  function frame(now) {
    const t = (now - startTime) / 1000; // seconds

    // --- Update lighthouse ---
    podium.updateUniforms('lighthouse', {
      uTime: t,
      uOpacity: 0.85 + 0.1 * Math.sin(t * 2.1)
    });

    // --- Update rings (staggered expansion) ---
    for (let i = 0; i < 3; i++) {
      // Each ring cycles through 0→1 over RING_LIFETIME seconds, offset by stagger
      const phase = ((t / RING_LIFETIME) + RING_STAGGER[i]) % 1.0;
      const scale = phase * 0.9 + 0.1; // 0.1 to ~0.99
      const opacity = Math.max(0, 1.0 - phase * 1.2) * 0.7;

      podium.updateUniforms(`ring${i}`, {
        uScale:   scale,
        uOpacity: opacity,
        uTime:    t
      });
    }

    // --- Update sweep ---
    const sweepAngle = (t * SWEEP_SPEED * 2 * Math.PI) % (2 * Math.PI);
    podium.updateUniforms('sweep', {
      uAngle:  sweepAngle,
      uOpacity: 0.55 + 0.15 * Math.sin(t * 1.7),
      uTime:   t
    });

    // --- Update agent pings (pulsing glow) ---
    for (const agent of AGENTS) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 2.5 + AGENTS.indexOf(agent) * 1.2);
      const intensity = clamp(0.4 + pulse * 0.6, 0.4, 1.0);
      podium.updateUniforms(`ping_${agent.id}`, {
        uIntensity: intensity,
        uPulse:     pulse,
        uTime:      t
      });
    }

    animationId = requestAnimationFrame(frame);
  }

  animationId = requestAnimationFrame(frame);
  console.info('[radar] WebGPU radar active — PodiumJS', typeof Podium !== 'undefined' ? Podium.version || '' : '');
}

export function destroyRadar() {
  if (animationId) cancelAnimationFrame(animationId);
  if (podium) {
    podium.stopRenderLoop();
    podium = null;
  }
}