/**
 * Room Metadata Proxy
 *
 * GET /api/room/:code
 *
 * Fetches room metadata from the Railway Sync Server and returns it as JSON.
 * The Sync Server URL is read from the SYNC_SERVER_URL environment variable.
 */

const SYNC_SERVER_URL = process.env.SYNC_SERVER_URL;

export default async function handler(req, res) {
  // ── Only accept GET ───────────────────────────────────────────────
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // ── Read room code from path parameter ────────────────────────────
  const { code } = req.query;

  if (!code) {
    return res.status(400).json({ error: 'Missing room code' });
  }

  if (!SYNC_SERVER_URL) {
    console.error('SYNC_SERVER_URL environment variable is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  try {
    const syncUrl = `${SYNC_SERVER_URL.replace(/\/+$/, '')}/api/room/${encodeURIComponent(code)}`;
    const upstream = await fetch(syncUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!upstream.ok) {
      // Forward the upstream status if the room isn't found, etc.
      const body = await upstream.text();
      return res.status(upstream.status).json({
        error: `Sync server returned ${upstream.status}`,
        detail: body,
      });
    }

    const data = await upstream.json();

    // Cache the response briefly so rapid refreshes don't hammer Railway
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=10');
    return res.status(200).json(data);
  } catch (err) {
    console.error('Error fetching room data from sync server:', err);
    return res.status(502).json({ error: 'Failed to reach sync server' });
  }
}
