// THE DOOR. Your change detector posts here when a page changes.
// It judges the change with Claude, stores the keepers, and emails Coleago.
// Self-contained on purpose: no imports, no shared files, nothing to break.

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
  if (!url || !token) throw new Error('Redis not configured');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json();
  return j.result;
}

// Saves a record of what arrived and what we decided.
async function record(entry) {
  try {
    await redis(['LPUSH', 'coleago:tenders', JSON.stringify(entry)]);
    await redis(['LTRIM', 'coleago:tenders', '0', '499']);
  } catch (e) {
    console.log('could not save record:', String(e.message || e));
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  // Only your change detector may come through this door.
  // Accepts either an Authorization header OR ?key=... on the URL,
  // because some monitoring tools make custom headers awkward.
  const secret = process.env.INGEST_SECRET;
  const headerAuth = (req.headers.authorization || '').replace('Bearer ', '').trim();
  const queryAuth = ((req.query && req.query.key) || '').toString().trim();
  if (!secret || (headerAuth !== secret && queryAuth !== secret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  // Body may arrive already-parsed or as a raw string.
  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = { changed_text: body }; }
  }

  const source = body.source || body.title || '';
  const url = body.url || body.watch_url || '';
  // Accept several field names so different tools work without fuss.
  const text = String(body.changed_text || body.diff || body.message || body.body || '').trim();
  const isTest = body.test === true || body.test === 'true';

  // Load the judging settings you set in the dashboard.
  let settings = DEFAULTS;
  try {
    const saved = await redis(['GET', 'coleago:settings']);
    if (saved) settings = { ...DEFAULTS, ...JSON.parse(saved) };
  } catch (e) {
    // No Redis yet? Carry on with the defaults so the judge still works.
  }

  const logAll = settings.logAll !== false;
  const base = {
    source,
    url,
    savedAt: new Date().toISOString(),
    preview: text.slice(0, 300), // what actually arrived, for verification
  };

  // --- nothing in the payload ---
  if (!text) {
    console.log('INGEST empty |', source, url);
    if (logAll && !isTest) await record({ ...base, status: 'empty', title: '(empty notification)' });
    return res.status(200).json({ skipped: true, reason: 'empty', source, url });
  }

  // --- FREE FILTER: skip Claude entirely if nothing tender-ish is present ---
  const hay = text.toLowerCase();
  const matched = (settings.keywords || []).some((k) => hay.includes(String(k).toLowerCase()));
  if (!matched) {
    console.log('INGEST no-keyword |', source, url);
    if (logAll && !isTest) await record({ ...base, status: 'no-keyword', title: '(no tender keywords)' });
    return res.status(200).json({ skipped: true, reason: 'no keyword match', source, url });
  }

  // THE JUDGE: one cheap Claude call.
  let verdict;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        system: settings.profile + `

Reply with ONLY a JSON object, no other text:
{"title":"","category":"","deadline":"","score":0,"rationale":""}
score is 0-100. Never invent details not in the text.`,
        messages: [{
          role: 'user',
          content: `Source: ${source}\nPage: ${url}\n\nChanged text:\n${text.slice(0, 6000)}`,
        }],
      }),
    });
    const data = await r.json();
    if (data.error) throw new Error(data.error.message || 'Claude error');
    const raw = (data.content || []).map((c) => c.text || '').join('');
    verdict = JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch (e) {
    const msg = String(e.message || e);
    console.log('INGEST judge-failed |', source, '|', msg);
    if (logAll && !isTest) await record({ ...base, status: 'error', title: '(judge failed)', rationale: msg });
    return res.status(500).json({ error: 'judge failed', detail: msg });
  }

  verdict.relevant = Number(verdict.score || 0) >= Number(settings.threshold || 60);
  console.log('INGEST', verdict.relevant ? 'KEPT' : 'dropped', '| score', verdict.score, '|', source);

  // Test mode stops here — nothing saved, nothing emailed.
  if (isTest) return res.status(200).json({ verdict, source, url });

  // Save keepers always; save the drops too while verification mode is on.
  if (verdict.relevant || logAll) {
    await record({ ...base, ...verdict, status: verdict.relevant ? 'kept' : 'dropped' });
  }

  // EMAIL TO COLEAGO - only for genuine keepers, and only once configured.
  if (verdict.relevant && process.env.RESEND_API_KEY && process.env.ALERT_EMAIL) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.ALERT_FROM || 'onboarding@resend.dev',
          to: process.env.ALERT_EMAIL,
          subject: `Tender (${verdict.score}): ${verdict.title}`,
          text: `${verdict.title}\n\nScore: ${verdict.score}\nCategory: ${verdict.category || '-'}\nDeadline: ${verdict.deadline || '-'}\nSource: ${source}\n${url}\n\nWhy: ${verdict.rationale || ''}`,
        }),
      });
    } catch (e) {
      // Email failing must never lose the tender - it's already saved.
    }
  }

  return res.status(200).json({ verdict, source, url });
}
