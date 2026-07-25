// Reads and saves the judging parameters shown on the dashboard.
// Self-contained on purpose: no imports.

const DEFAULTS = {
  profile: `You are a procurement filter for Coleago Consulting, a telecoms management consultancy.

Coleago bids for: spectrum strategy, spectrum valuation and auction support, 5G and network strategy, telecoms business modelling, regulatory and policy advisory, market and demand studies, feasibility studies, due diligence, and telecoms training.

Score 70-100 if the text describes consultancy, advisory, study, valuation, modelling, strategy or training work in telecoms/spectrum.
Score 0-30 for equipment supply, construction, cabling, vehicles, cleaning, catering, staffing, office IT, or notices with no consulting scope.
Score 31-69 if genuinely unclear.`,
  threshold: 60,
  keywords: ['tender', 'rfp', 'rfq', 'proposal', 'expression of interest', 'eoi',
    'procurement', 'consult', 'advisory', 'study', "appel d'offre", 'bid',
    'terms of reference', 'invitation to bid'],
  logAll: true, // VERIFICATION MODE: record every notification, not just the keepers
};

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
  if (req.method === 'GET') {
    try {
      const saved = await redis(['GET', 'coleago:settings']);
      return res.status(200).json(saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS);
    } catch (e) {
      // No storage yet — show the defaults rather than an error page.
      return res.status(200).json({ ...DEFAULTS, _warning: String(e.message || e) });
    }
  }

  if (req.method === 'POST') {
    const b = req.body || {};
    const next = { ...DEFAULTS };
    if (typeof b.profile === 'string') next.profile = b.profile;
    if (b.threshold != null) next.threshold = Number(b.threshold);
    if (Array.isArray(b.keywords)) next.keywords = b.keywords;
    if (b.logAll != null) next.logAll = !!b.logAll;
    try {
      await redis(['SET', 'coleago:settings', JSON.stringify(next)]);
      return res.status(200).json(next);
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  return res.status(405).json({ error: 'Use GET or POST' });
}
