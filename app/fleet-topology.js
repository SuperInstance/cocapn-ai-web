/**
 * Fleet Topology Graph — D3.js force-directed graph of the CoCapn fleet
 * Phase B: Live agent topology with trust-based edges
 */

import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

const PLATO_BASE = 'http://localhost:8847';
const POLL_INTERVAL = 10000; // 10 seconds

// Agent definitions with hardcoded baseline stats
const AGENTS = [
  {
    id: 'oracle1',
    name: 'Oracle1',
    role: 'Keeper',
    description: 'PLATO coordination, architecture, fleet-wide constraint propagation',
    uptime: 99.9,
    lastSeen: Date.now(),
    status: 'online',
    color: '#f59e0b',
  },
  {
    id: 'jc1',
    name: 'JetsonClaw1',
    role: 'Edge',
    description: 'Sensor fusion, GPU workloads, offline-capable hardware floor agent',
    uptime: 95.2,
    lastSeen: Date.now() - 300000,
    status: 'degraded',
    color: '#10b981',
  },
  {
    id: 'forgemaster',
    name: 'Forgemaster',
    role: 'Foundry',
    description: 'LoRA training, Rust compilation, constraint-to-native training rig',
    uptime: 98.7,
    lastSeen: Date.now(),
    status: 'online',
    color: '#a855f7',
  },
  {
    id: 'ccc',
    name: 'CCC',
    role: 'Public',
    description: 'Kimi K2.5 reasoning, Telegram interface, public crew communication',
    uptime: 100.0,
    lastSeen: Date.now(),
    status: 'online',
    color: '#3b82f6',
  },
];

// Edge definitions with trust scores
const EDGES = [
  { source: 'oracle1', target: 'jc1', trust: 0.8, label: 'monitored by keeper' },
  { source: 'oracle1', target: 'forgemaster', trust: 0.9, label: 'architecture reported' },
  { source: 'oracle1', target: 'ccc', trust: 0.7, label: 'public face monitored' },
  { source: 'jc1', target: 'forgemaster', trust: 0.6, label: 'hardware collaboration' },
  { source: 'forgemaster', target: 'oracle1', trust: 0.9, label: 'decisions reported' },
];

function trustColor(trust) {
  if (trust >= 0.8) return '#22c55e';
  if (trust >= 0.6) return '#eab308';
  return '#ef4444';
}

function trustWidth(trust) {
  return 1 + trust * 4;
}

function statusToColor(status) {
  switch (status) {
    case 'online': return '#22c55e';
    case 'degraded': return '#eab308';
    case 'failed': return '#ef4444';
    default: return '#64748b';
  }
}

function nodeRadius(uptime) {
  return 14 + (uptime / 100) * 10;
}

export async function fetchFleetHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${PLATO_BASE}/room/fleet_health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function initFleetTopology(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const width = container.clientWidth || 800;
  const height = 400;

  // Clear any existing SVG
  container.innerHTML = '';

  const svg = d3
    .select(`#${containerId}`)
    .append('svg')
    .attr('width', '100%')
    .attr('height', height)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('max-width', '100%')
    .style('overflow', 'visible');

  // Zoom & pan
  const g = svg.append('g');
  svg.call(
    d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      })
  );

  // Arrow marker for directed edges
  svg
    .append('defs')
    .append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#64748b');

  // Tooltip
  const tooltip = d3
    .select(`#${containerId}`)
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0)
    .style('position', 'absolute')
    .style('background', 'var(--surface2)')
    .style('border', '1px solid var(--border)')
    .style('border-radius', '8px')
    .style('padding', '0.75rem')
    .style('font-size', '0.85rem')
    .style('pointer-events', 'none')
    .style('z-index', '10')
    .style('min-width', '180px');

  // Deep copy nodes & edges for simulation
  const nodes = AGENTS.map((a) => ({ ...a }));
  const links = EDGES.map((e) => ({ ...e }));

  // Force simulation
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(140)
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(40));

  // Draw edges
  const edge = g
    .append('g')
    .attr('class', 'edges')
    .selectAll('line')
    .data(links)
    .join('line')
    .attr('class', 'edge')
    .attr('stroke', (d) => trustColor(d.trust))
    .attr('stroke-width', (d) => trustWidth(d.trust))
    .attr('stroke-opacity', 0.7)
    .attr('marker-end', 'url(#arrowhead)');

  // Draw nodes
  const node = g
    .append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .join('g')
    .attr('class', 'node')
    .style('cursor', 'pointer')
    .call(
      d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
    );

  // Node circles
  node
    .append('circle')
    .attr('r', (d) => nodeRadius(d.uptime))
    .attr('fill', (d) => statusToColor(d.status))
    .attr('stroke', 'var(--bg)')
    .attr('stroke-width', 2)
    .style('filter', (d) => `drop-shadow(0 0 6px ${statusToColor(d.status)})`);

  // Node labels
  node
    .append('text')
    .attr('dy', (d) => nodeRadius(d.uptime) + 14)
    .attr('text-anchor', 'middle')
    .style('font-family', "'Space Mono', monospace")
    .style('font-size', '0.75rem')
    .style('fill', 'var(--text)')
    .text((d) => d.name);

  // Role sublabels
  node
    .append('text')
    .attr('dy', (d) => nodeRadius(d.uptime) + 26)
    .attr('text-anchor', 'middle')
    .style('font-family', "'Space Mono', monospace")
    .style('font-size', '0.65rem')
    .style('fill', 'var(--muted)')
    .text((d) => d.role);

  // Hover interactions
  node
    .on('mouseover', (event, d) => {
      tooltip.transition().duration(150).style('opacity', 1);
      tooltip.html(`
        <div style="font-weight:700;margin-bottom:0.4rem;color:var(--text)">${d.name}</div>
        <div style="color:var(--accent);margin-bottom:0.4rem">${d.role}</div>
        <div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.4rem">
          <span style="width:8px;height:8px;border-radius:50%;background:${statusToColor(d.status)};display:inline-block"></span>
          <span style="color:${statusToColor(d.status)}">${d.status.charAt(0).toUpperCase() + d.status.slice(1)}</span>
        </div>
        <div style="color:var(--muted);margin-bottom:0.4rem">Uptime: <span style="color:var(--text)">${d.uptime}%</span></div>
        <div style="color:var(--muted);font-size:0.75rem;line-height:1.4">${d.description}</div>
      `);
    })
    .on('mousemove', (event) => {
      const rect = container.getBoundingClientRect();
      tooltip
        .style('left', event.clientX - rect.left + 12 + 'px')
        .style('top', event.clientY - rect.top - 10 + 'px');
    })
    .on('mouseout', () => {
      tooltip.transition().duration(150).style('opacity', 0);
    })
    .on('click', (event, d) => {
      // Click node: show recent tiles from PLATO
      showAgentTiles(d.id, d.name);
    });

  // Tick
  simulation.on('tick', () => {
    edge
      .attr('x1', (d) => d.source.x)
      .attr('y1', (d) => d.source.y)
      .attr('x2', (d) => d.target.x)
      .attr('y2', (d) => d.target.y);

    node.attr('transform', (d) => `translate(${d.x},${d.y})`);
  });

  // Live update
  async function updateFromPlato() {
    const health = await fetchFleetHealth();
    if (!health) return;

    // Update node statuses from fleet_health if data available
    if (health.agents) {
      health.agents.forEach((agent) => {
        const node = nodes.find((n) => n.id === agent.id);
        if (node) {
          node.status = agent.status || node.status;
          node.uptime = agent.uptime || node.uptime;
          if (agent.last_seen) {
            node.lastSeen = new Date(agent.last_seen).getTime();
          }
        }
      });
    }

    // Update visual states
    node
      .select('circle')
      .attr('fill', (d) => statusToColor(d.status))
      .attr('r', (d) => nodeRadius(d.uptime))
      .style('filter', (d) => `drop-shadow(0 0 6px ${statusToColor(d.status)})`);
  }

  setInterval(updateFromPlato, POLL_INTERVAL);

  return { svg, simulation, nodes, links, node, edge };
}

async function showAgentTiles(agentId, agentName) {
  // Fetch recent tiles from PLATO for this agent
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${PLATO_BASE}/room/${agentId}_tiles`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return;
    const data = await res.json();
    // Show in a modal-like overlay
    showTilesModal(agentName, data.tiles || []);
  } catch {
    // Silently fail — tiles are a bonus feature
  }
}

function showTilesModal(agentName, tiles) {
  // Remove existing modal
  const existing = document.getElementById('fleet-topology-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'fleet-topology-modal';
  modal.style.cssText = `
    position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1000;
    display: flex; align-items: center; justify-content: center; padding: 1rem;
  `;
  const content = document.createElement('div');
  content.style.cssText = `
    background: var(--surface2); border: 1px solid var(--border);
    border-radius: 12px; padding: 1.5rem; max-width: 500px; width: 100%; max-height: 70vh; overflow-y: auto;
  `;
  content.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
      <h3 style="color:var(--text);font-family:'Space Mono',monospace">${agentName} — Recent Tiles</h3>
      <button id="modal-close" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:1.2rem">×</button>
    </div>
    ${
      tiles.length === 0
        ? '<p style="color:var(--muted)">No recent tiles available.</p>'
        : tiles
            .slice(0, 10)
            .map(
              (t) => `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:0.75rem;margin-bottom:0.5rem">
        <div style="font-family:'Space Mono',monospace;font-size:0.8rem;color:var(--accent);margin-bottom:0.25rem">${t.id || t.tile_id || 'tile'}</div>
        <div style="color:var(--muted);font-size:0.8rem">${t.content || t.text || JSON.stringify(t).slice(0, 100)}</div>
      </div>
    `
            )
            .join('')
    }
  `;
  modal.appendChild(content);
  document.body.appendChild(modal);

  document.getElementById('modal-close').onclick = () => modal.remove();
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };
}
