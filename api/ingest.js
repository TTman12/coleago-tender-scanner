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
  keywords: ["tender", "tenders", "tendering", "invitation to tender", "invitation to bid", "itb", "itt", "request for proposal", "request for proposals", "rfp", "request for quotation", "rfq", "request for information", "rfi", "expression of interest", "expressions of interest", "eoi", "call for proposals", "call for tenders", "call for bids", "procurement", "procurement notice", "terms of reference", "tor", "bid", "bidding", "bidder", "solicitation", "prequalification", "pre-qualification", "shortlist", "framework agreement", "contract notice", "contract award", "award notice", "submission deadline", "closing date", "consultancy", "consultancy services", "consulting services", "consultant", "consultants", "advisory services", "technical assistance", "scope of work", "statement of work", "request for services", "competitive bidding", "procure", "spectrum", "spectrum strategy", "spectrum valuation", "spectrum pricing", "spectrum auction", "spectrum award", "spectrum assignment", "spectrum renewal", "spectrum licence", "spectrum license", "licence renewal", "license renewal", "auction design", "auction", "reserve price", "refarming", "band plan", "frequency", "frequency assignment", "frequency allocation", "radio spectrum", "5g", "4g", "lte", "imt", "mmwave", "millimetre wave", "network strategy", "network planning", "network sharing", "infrastructure sharing", "ran", "radio access network", "business modelling", "business modeling", "financial model", "financial modelling", "business plan", "business planning", "cost model", "cost modelling", "lric", "bu-lric", "cost of capital", "wacc", "tariff", "tariff review", "pricing review", "price review", "benchmarking", "benchmark study", "regulatory", "regulation", "regulatory framework", "regulatory advisory", "policy", "policy advisory", "policy review", "universal service", "universal access", "uso", "interconnection", "interconnect", "market study", "market analysis", "market review", "demand study", "demand forecast", "significant market power", "smp", "competition assessment", "feasibility study", "feasibility", "techno-economic", "due diligence", "valuation", "transaction advisory", "mergers and acquisitions", "m&a", "acquisition", "divestment", "broadband plan", "national broadband", "broadband strategy", "digital strategy", "digital transformation", "fibre", "fiber", "ftth", "fttx", "backbone", "backhaul", "tower", "towerco", "passive infrastructure", "satellite", "leo", "direct-to-device", "d2d", "mvno", "numbering", "numbering plan", "quality of service", "qos", "coverage obligation", "spectrum audit", "spectrum monitoring", "training", "capacity building", "workshop", "seminar", "masterclass", "study", "strategy", "review", "assessment", "analysis", "audit", "roadmap", "white paper", "impact assessment", "cost benefit analysis", "appel d'offres", "appel d offres", "appels d'offres", "avis d'appel d'offres", "aoo", "aoi", "manifestation d'intérêt", "avis de manifestation d'intérêt", "ami", "demande de propositions", "consultation", "conseil", "étude", "études", "marché public", "marchés publics", "cahier des charges", "termes de référence", "soumission", "adjudication", "attribution", "préqualification", "spectre", "fréquences", "enchères", "licence", "réglementation", "régulation", "formation", "expertise", "assistance technique", "faisabilité", "évaluation", "stratégie", "licitación", "licitaciones", "concurso", "concurso público", "convocatoria", "pliego", "pliego de condiciones", "términos de referencia", "expresión de interés", "manifestación de interés", "propuesta", "solicitud de propuestas", "contratación", "contratación pública", "adjudicación", "consultoría", "consultor", "asesoría", "estudio", "estudios", "espectro", "frecuencias", "subasta", "licencia", "regulación", "normativa", "formación", "capacitación", "viabilidad", "evaluación", "estrategia", "edital", "licitação", "proposta", "pedido de propostas", "manifestação de interesse", "termos de referência", "aquisição", "adjudicação", "consultoria", "assessoria", "estudo", "frequências", "leilão", "licença", "regulamentação", "formação", "capacitação", "viabilidade", "avaliação", "estratégia", "gara", "bando", "bando di gara", "appalto", "offerta", "consulenza", "studio", "spettro", "frequenze", "ausschreibung", "vergabe", "angebot", "beratung", "studie", "frequenz", "spektrum", "lizenz", "aanbesteding", "offerte", "advies", "onderzoek", "مناقصة", "مناقصات", "عطاء", "عطاءات", "دعوة", "استدراج عروض", "طلب عروض", "إعلان", "استشارة", "استشاري", "دراسة", "الطيف", "الترددات", "مزاد", "ترخيص", "تنظيم", "تدريب", "تقييم", "тендер", "закупка", "закупки", "конкурс", "запрос предложений", "заявка", "консультация", "консультант", "исследование", "спектр", "частоты", "аукцион", "лицензия", "регулирование", "обучение", "ihale", "teklif", "danışmanlık", "etüt", "frekans", "lisans", "lelang", "pengadaan", "konsultasi", "studi", "frekuensi", "izin", "zabuni", "ushauri", "utafiti"],
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

// Runs several Redis commands in one round trip where possible.
async function redisPipeline(commands) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return;
  try {
    const r = await fetch(url.replace(/\/$/, '') + '/pipeline', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
    });
    if (r.ok) return await r.json();
  } catch (e) { /* fall through */ }
  // Fallback: run them one at a time.
  for (const c of commands) { try { await redis(c); } catch (e) {} }
}

// Running totals, kept separately from the records themselves so that the
// numbers survive verification mode being switched off, items being binned,
// and old records being purged.
const STATS = 'coleago:stats';
const SOURCES = 'coleago:sources';

async function bump(fields, source) {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
  const cmds = [];
  for (const [name, by] of Object.entries(fields)) {
    if (by) cmds.push(['HINCRBY', STATS, day + ':' + name, String(by)]);
  }
  if (source) {
    const key = String(source).slice(0, 60);
    if (fields.received) cmds.push(['HINCRBY', SOURCES, key + '|received', '1']);
    if (fields.kept)     cmds.push(['HINCRBY', SOURCES, key + '|kept', '1']);
    if (fields.judged)   cmds.push(['HINCRBY', SOURCES, key + '|judged', '1']);
  }
  if (cmds.length) await redisPipeline(cmds);
}

// Saves a record of what arrived and what we decided.
// Stored in a hash keyed by id so it can later be starred, opened or binned.
async function record(entry) {
  try {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const full = { id, opened: false, starred: false, ...entry };
    await redis(['HSET', 'coleago:records', id, JSON.stringify(full)]);
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

  if (!isTest) await bump({ received: 1 }, source);

  // --- nothing in the payload ---
  if (!text) {
    console.log('INGEST empty |', source, url);
    if (!isTest) await bump({ empty: 1 });
    if (logAll && !isTest) await record({ ...base, status: 'empty', title: '(empty notification)' });
    return res.status(200).json({ skipped: true, reason: 'empty', source, url });
  }

  // --- FREE FILTER: skip Claude entirely if nothing tender-ish is present ---
  // Three ways a change gets through:
  //   1. no keywords configured at all  -> the gate is off
  //   2. the text uses a non-Latin script -> Latin keywords could never match it,
  //      so let Claude read it rather than silently discarding it
  //   3. a keyword actually appears
  const hay = text.toLowerCase();
  const list = settings.keywords || [];
  const nonLatin = /[\u0600-\u06FF\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F\u1200-\u137F]/.test(text);
  const matched = list.length === 0 || nonLatin || list.some((k) => hay.includes(String(k).toLowerCase()));
  if (!matched) {
    console.log('INGEST no-keyword |', source, url);
    if (!isTest) await bump({ gated: 1 });
    if (logAll && !isTest) await record({ ...base, status: 'no-keyword', title: '(no tender keywords)' });
    return res.status(200).json({ skipped: true, reason: 'no keyword match', source, url });
  }

  // THE JUDGE: one cheap Claude call.
  let verdict, usage = {};
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

The notice may be written in ANY language. Always reply in English: translate the title,
category and rationale into clear English regardless of the original language. Judge the
notice on its meaning, not on which language it is written in.

Reply with ONLY a JSON object, no other text:
{"title":"","category":"","deadline":"","score":0,"rationale":"","language":""}
"title", "category" and "rationale" must be in English.
"language" is the English name of the original language (for example "French", "Arabic",
"Portuguese"), or "English" if it was already English.
"deadline" should be an ISO date (YYYY-MM-DD) where one is given, otherwise "".
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
    // Real token usage, so cost reporting is measured rather than estimated.
    usage = data.usage || {};
  } catch (e) {
    const msg = String(e.message || e);
    console.log('INGEST judge-failed |', source, '|', msg);
    if (!isTest) await bump({ judged: 1, errors: 1 }, source);
    if (logAll && !isTest) await record({ ...base, status: 'error', title: '(judge failed)', rationale: msg });
    return res.status(500).json({ error: 'judge failed', detail: msg });
  }

  verdict.relevant = Number(verdict.score || 0) >= Number(settings.threshold || 60);
  console.log('INGEST', verdict.relevant ? 'KEPT' : 'dropped', '| score', verdict.score, '|', source);

  if (!isTest) {
    await bump({
      judged: 1,
      kept: verdict.relevant ? 1 : 0,
      in_tokens: Number(usage.input_tokens || 0),
      out_tokens: Number(usage.output_tokens || 0),
    }, source);
  }

  // Test mode stops here — nothing saved, nothing emailed.
  if (isTest) return res.status(200).json({ verdict, source, url });

  // Save keepers always; save the drops too while verification mode is on.
  if (verdict.relevant || logAll) {
    await record({
      ...base, ...verdict,
      status: verdict.relevant ? 'kept' : 'dropped',
      inTokens: Number(usage.input_tokens || 0),
      outTokens: Number(usage.output_tokens || 0),
    });
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
