// ES module
import { getTiles } from './plato-client.js';

export async function initPlatoExplorer(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const roomSelect = container.querySelector('.room-select');
  const loadBtn = container.querySelector('.load-btn');
  const tileList = container.querySelector('.tile-list');
  const tileCount = container.querySelector('.tile-count');

  const ROOMS = [
    'fleet_health',
    'zeroclaw_bard',
    'zeroclaw_warden',
    'zeroclaw_healer',
    'oracle1_infrastructure',
    'murmur_insights',
    'fleet_vessels',
    'fleet_trust',
  ];

  // Populate dropdown
  ROOMS.forEach(room => {
    const opt = document.createElement('option');
    opt.value = room;
    opt.textContent = room;
    roomSelect.appendChild(opt);
  });

  loadBtn.addEventListener('click', async () => {
    const room = roomSelect.value;
    tileList.innerHTML = '<div class="loading">Loading...</div>';
    let tiles;
    try {
      tiles = await getTiles(room);
    } catch (e) {
      tileList.innerHTML = '<div class="loading" style="color:var(--danger)">Failed to connect to PLATO</div>';
      return;
    }
    tileList.innerHTML = '';
    tileCount.textContent = `${Array.isArray(tiles) ? tiles.length : 0} tiles`;

    const safeTiles = Array.isArray(tiles) ? tiles : [];
    safeTiles.slice(0, 50).forEach(tile => {
      const el = document.createElement('div');
      el.className = 'tile-item';
      const content = tile.question || tile.content || tile.answer || '';
      el.innerHTML = `
        <div class="tile-meta">
          <span class="mono">#${tile.id}</span>
          <span class="ts">${tile.timestamp ? new Date(tile.timestamp * 1000).toLocaleString() : '—'}</span>
        </div>
        <div class="tile-content">${content}</div>
      `;
      tileList.appendChild(el);
    });

    if (safeTiles.length === 0) {
      tileList.innerHTML = '<div class="loading">No tiles in this room</div>';
    }
  });
}