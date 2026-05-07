/**
 * PLATO Client — JavaScript client for PLATO room server at localhost:8847
 * Same API shape as CocapnPlatoClient.php but in vanilla JS
 */

const PLATO_BASE = 'http://localhost:8847';
const TIMEOUT_MS = 3000;

class PlatoClient {
  constructor(baseUrl = PLATO_BASE) {
    this.baseUrl = baseUrl;
  }

  async _get(path) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${this.baseUrl}${path}`, {
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  }

  async _post(path, data) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!res.ok) return { error: 'POST failed' };
      return res.json();
    } catch {
      return { error: 'Connection failed' };
    }
  }

  /** GET /status → { rooms: { room_name: { tile_count, created } } } */
  async getStatus() {
    const data = await this._get('/status');
    if (!data) return { rooms: [], connected: false };
    return {
      rooms: data.rooms || data || [],
      connected: true,
    };
  }

  /** GET /room/{name}/tiles → tiles array */
  async getTiles(roomName) {
    const encoded = encodeURIComponent(roomName);
    const data = await this._get(`/room/${encoded}/tiles`);
    if (!data) return [];
    return Array.isArray(data) ? data : (data.tiles || []);
  }

  /** GET /rooms → room list */
  async getRooms() {
    const data = await this._get('/rooms');
    if (!data) return [];
    return Array.isArray(data) ? data : Object.keys(data);
  }

  /** POST /submit → submit a tile */
  async submitTile(tile) {
    const payload = {
      domain: tile.room || tile.domain || 'general',
      agent: tile.agent || 'cocapn-www',
      question: tile.content || tile.question || '',
    };
    if (tile.tags) payload.tags = tile.tags;
    return this._post('/submit', payload);
  }

  /** GET /search?q=query → search tiles */
  async searchTiles(query) {
    const data = await this._get(`/search?q=${encodeURIComponent(query)}`);
    if (!data) return [];
    return data.results || data || [];
  }
}

export { PlatoClient, PLATO_BASE };
