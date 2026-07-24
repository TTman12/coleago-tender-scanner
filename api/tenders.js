// Returns the tenders that passed the judge, newest first.
// Self-contained on purpose: no imports.

async function redis(command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Storage not connected yet');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json();
  return j.result;
}

export default async function handler(req, res) {
  try {
    const rows = await redis(['LRANGE', 'coleago:tenders', '0', '99']);
    const items = (rows || []).map((s) => {
      try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; }
    }).filter(Boolean);
    return res.status(200).json(items);
  } catch (e) {
    return res.status(200).json([]); // empty list rather than a broken page
  }
}
