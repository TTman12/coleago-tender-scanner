// Lists and manages recorded opportunities.
// Records live in a Redis HASH (field = id) so individual ones can be
// starred, opened, binned or deleted. Self-contained on purpose: no imports.

const HASH = 'coleago:records';
const OLD_LIST = 'coleago:tenders'; // pre-upgrade storage, migrated on first read
const BIN_DAYS = 7;
const MAX_RECORDS = 500;

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
  if (j.error) throw new Error(j.error);
  return j.result;
}

function parse(v) {
  try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; }
}

// Upstash returns a hash as a flat [field, value, field, value, ...] array.
function hashToRecords(flat) {
  const out = [];
  if (!flat) return out;
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) {
      const rec = parse(flat[i + 1]);
      if (rec) { rec.id = rec.id || flat[i]; out.push(rec); }
    }
  } else if (typeof flat === 'object') {
    for (const [k, v] of Object.entries(flat)) {
      const rec = parse(v);
      if (rec) { rec.id = rec.id || k; out.push(rec); }
    }
  }
  return out;
}

// When a record is binned we also blocklist its fingerprint, so the same
// notice re-appearing on the next check does not come back.
async function suppress(rec, on) {
  if (!rec || !rec.fp) return;
  try {
    if (on) await redis(['HSET', 'coleago:blocked', rec.fp, JSON.stringify({ title: rec.title || '', at: new Date().toISOString() })]);
    else await redis(['HDEL', 'coleago:blocked', rec.fp]);
  } catch (e) { /* non-fatal */ }
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Bring any records from the old list format into the hash, once.
async function migrateOldList() {
  let rows;
  try { rows = await redis(['LRANGE', OLD_LIST, '0', '499']); } catch { return; }
  if (!rows || !rows.length) return;
  for (const row of rows) {
    const rec = parse(row);
    if (!rec) continue;
    rec.id = rec.id || newId();
    await redis(['HSET', HASH, rec.id, JSON.stringify(rec)]);
  }
  await redis(['DEL', OLD_LIST]);
}

export default async function handler(req, res) {
  // ---------- actions ----------
  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const { action, id } = body;

    try {
      if (action === 'emptyBin') {
        const all = hashToRecords(await redis(['HGETALL', HASH]));
        for (const r of all) if (r.deletedAt) await redis(['HDEL', HASH, r.id]);
        return res.status(200).json({ ok: true });
      }

      if (!id) return res.status(400).json({ error: 'missing id' });

      if (action === 'deleteForever') {
        try {
          const r = parse(await redis(['HGET', HASH, id]));
          if (r) await suppress(r, true);
        } catch (e) { /* non-fatal */ }
        await redis(['HDEL', HASH, id]);
        return res.status(200).json({ ok: true });
      }

      const raw = await redis(['HGET', HASH, id]);
      const rec = parse(raw);
      if (!rec) return res.status(404).json({ error: 'not found' });
      rec.id = rec.id || id;

      if (action === 'bin') {
        rec.deletedAt = new Date().toISOString();
        await suppress(rec, true);   // stop this notice coming back
      }
      else if (action === 'restore') {
        delete rec.deletedAt;
        await suppress(rec, false);  // allow it again
      }
      else if (action === 'star')    rec.starred = true;
      else if (action === 'unstar')  rec.starred = false;
      else if (action === 'open')    rec.opened = true;
      else if (action === 'unopen')  rec.opened = false;
      else return res.status(400).json({ error: 'unknown action' });

      await redis(['HSET', HASH, id, JSON.stringify(rec)]);
      return res.status(200).json({ ok: true, record: rec });
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  // ---------- list ----------
  try {
    await migrateOldList();
    let all = hashToRecords(await redis(['HGETALL', HASH]));

    // Purge anything that has sat in the bin longer than BIN_DAYS.
    const cutoff = Date.now() - BIN_DAYS * 86400000;
    const survivors = [];
    for (const r of all) {
      if (r.deletedAt && new Date(r.deletedAt).getTime() < cutoff) {
        await redis(['HDEL', HASH, r.id]);
      } else {
        survivors.push(r);
      }
    }
    all = survivors;

    // Newest first.
    all.sort((a, b) => String(b.savedAt || '').localeCompare(String(a.savedAt || '')));

    // Keep storage bounded: drop the oldest beyond the cap.
    if (all.length > MAX_RECORDS) {
      for (const r of all.slice(MAX_RECORDS)) await redis(['HDEL', HASH, r.id]);
      all = all.slice(0, MAX_RECORDS);
    }

    return res.status(200).json({ records: all, binDays: BIN_DAYS });
  } catch (e) {
    return res.status(200).json({ records: [], binDays: BIN_DAYS, warning: String(e.message || e) });
  }
}
