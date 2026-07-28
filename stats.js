// Usage and cost reporting. Reads the running counters that ingest.js keeps,
// so the numbers survive verification mode being off and records being purged.
// Self-contained on purpose: no imports.

const STATS = 'coleago:stats';
const SOURCES = 'coleago:sources';

// Claude Haiku 4.5 list price, US dollars per million tokens.
// Update these two lines if the model or pricing changes.
const USD_PER_M_INPUT = 1.00;
const USD_PER_M_OUTPUT = 5.00;

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

// Upstash returns a hash as a flat [field, value, field, value, ...] array.
function flatToObject(flat) {
  const o = {};
  if (!flat) return o;
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) o[flat[i]] = flat[i + 1];
  } else if (typeof flat === 'object') {
    Object.assign(o, flat);
  }
  return o;
}

const METRICS = ['received', 'gated', 'empty', 'judged', 'kept', 'errors', 'in_tokens', 'out_tokens'];

function blank() {
  const o = {};
  for (const m of METRICS) o[m] = 0;
  return o;
}

function cost(inTok, outTok) {
  return (inTok / 1e6) * USD_PER_M_INPUT + (outTok / 1e6) * USD_PER_M_OUTPUT;
}

export default async function handler(req, res) {
  try {
    const raw = flatToObject(await redis(['HGETALL', STATS]));

    // Rebuild per-day buckets from "YYYY-MM-DD:metric" fields.
    const days = {};
    for (const [field, value] of Object.entries(raw)) {
      const idx = field.lastIndexOf(':');
      if (idx < 0) continue;
      const day = field.slice(0, idx);
      const metric = field.slice(idx + 1);
      if (!METRICS.includes(metric)) continue;
      days[day] = days[day] || blank();
      days[day][metric] += Number(value) || 0;
    }

    const today = new Date().toISOString().slice(0, 10);
    const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

    function sumSince(fromDay) {
      const t = blank();
      for (const [day, v] of Object.entries(days)) {
        if (fromDay && day < fromDay) continue;
        for (const m of METRICS) t[m] += v[m];
      }
      return t;
    }

    const periods = {
      today: sumSince(today),
      week: sumSince(daysAgo(6)),
      month: sumSince(daysAgo(29)),
      all: sumSince(null),
    };
    for (const p of Object.values(periods)) {
      p.cost = Number(cost(p.in_tokens, p.out_tokens).toFixed(4));
    }

    // Last 30 days as an ordered series for the chart.
    const series = [];
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const v = days[d] || blank();
      series.push({ day: d, received: v.received, judged: v.judged, kept: v.kept, gated: v.gated });
    }

    // Per-source totals.
    let sources = [];
    try {
      const s = flatToObject(await redis(['HGETALL', SOURCES]));
      const bySource = {};
      for (const [field, value] of Object.entries(s)) {
        const idx = field.lastIndexOf('|');
        if (idx < 0) continue;
        const name = field.slice(0, idx);
        const metric = field.slice(idx + 1);
        bySource[name] = bySource[name] || { source: name, received: 0, judged: 0, kept: 0 };
        if (metric in bySource[name]) bySource[name][metric] += Number(value) || 0;
      }
      sources = Object.values(bySource).sort((a, b) => b.received - a.received).slice(0, 40);
    } catch (e) { /* sources are optional */ }

    // A projection is more useful than a raw total for budgeting.
    const perJudgement = periods.all.judged
      ? cost(periods.all.in_tokens, periods.all.out_tokens) / periods.all.judged
      : 0;
    const activeDays = Object.keys(days).length || 1;
    const dailyAvgCost = cost(periods.all.in_tokens, periods.all.out_tokens) / activeDays;

    return res.status(200).json({
      periods,
      series,
      sources,
      pricing: { inputPerM: USD_PER_M_INPUT, outputPerM: USD_PER_M_OUTPUT },
      perJudgement: Number(perJudgement.toFixed(6)),
      projectedMonthly: Number((dailyAvgCost * 30).toFixed(2)),
      activeDays,
    });
  } catch (e) {
    return res.status(200).json({
      periods: { today: blank(), week: blank(), month: blank(), all: blank() },
      series: [], sources: [], warning: String(e.message || e),
      pricing: { inputPerM: USD_PER_M_INPUT, outputPerM: USD_PER_M_OUTPUT },
      perJudgement: 0, projectedMonthly: 0, activeDays: 0,
    });
  }
}
