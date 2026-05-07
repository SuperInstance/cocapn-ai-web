// ES module
import { getTiles } from './plato-client.js';

const QUALITY_THRESHOLD = 0.35;
const POLL_INTERVAL = 10000; // 10s

export async function initMurmurInsights(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Empty state
  container.innerHTML = '<div class="murmur-empty">Murmur is thinking... insights will appear here</div>';

  let lastTileId = null;

  async function poll() {
    let tiles;
    try {
      tiles = await getTiles('murmur_insights');
    } catch (e) {
      // PLATO unreachable — show loading state
      if (container.querySelector('.murmur-empty')) {
        container.innerHTML = '<div class="murmur-empty">Insights loading...</div>';
      }
      return;
    }

    if (!tiles || tiles.length === 0) {
      if (!container.querySelector('.murmur-empty')) {
        container.innerHTML = '<div class="murmur-empty">Murmur is thinking... insights will appear here</div>';
      }
      return;
    }

    // Remove empty state on first successful fetch
    const emptyEl = container.querySelector('.murmur-empty');
    if (emptyEl) emptyEl.remove();

    // Filter quality-gated insights
    const qualified = tiles.filter(t =>
      (t.quality_score || 0) >= QUALITY_THRESHOLD &&
      t.id !== lastTileId
    );

    qualified.forEach(tile => injectInsight(tile));

    if (tiles[0]) lastTileId = tiles[0].id;
  }

  function injectInsight(tile) {
    const el = document.createElement('div');
    el.className = 'insight-card';
    const content = tile.answer || tile.content || tile.question || '';
    const tags = tile.tags || [];
    el.innerHTML = `
      <div class="insight-meta">
        <span class="mono">#${tile.id}</span>
        <span class="quality-badge">${((tile.quality_score || 0) * 100).toFixed(0)}%</span>
      </div>
      <div class="insight-content">${content}</div>
      ${tags.length ? `<div class="insight-tags">${tags.map(t => `<span class="tag">${t}</span>`).join('')}</div>` : ''}
    `;
    el.style.animation = 'fadeSlideIn 0.4s ease-out';
    container.prepend(el);
    while (container.children.length > 20) {
      container.lastChild.remove();
    }
  }

  // Start polling
  setInterval(poll, POLL_INTERVAL);
  await poll(); // initial fetch
}