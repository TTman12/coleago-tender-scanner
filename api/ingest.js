// THE DOOR. Your change detector posts here when a page changes.
// It judges the change with Claude, stores the keepers, and emails Coleago.
// Self-contained on purpose: no imports, no shared files, nothing to break.

const DEFAULTS = {
  profile: `You are a procurement and market-intelligence filter for Coleago Consulting, a specialist telecoms management consultancy.

WHAT COLEAGO DOES, in rough order of importance:
1. Spectrum (their heartland): auctions, awards, assignment, valuation, pricing, reserve prices, spectrum strategy and policy, licence renewals and fees, caps, refarming, sharing, trading, band plans, WRC preparation, digital dividend.
2. Auction design and bidder support: auction rules and formats (CCA, SMRA, sealed bid, clock), mock auctions, bidding strategy, bid books, war gaming, live auction support, beauty contests and comparative selection.
3. Regulatory and policy advisory: regulatory advocacy, position papers, consultation responses, expert witness and litigation support, competition assessment, coverage obligations, universal service, interconnection and termination rates, margin squeeze, licence conditions, market reviews.
4. Business modelling and strategy: business plans and cases, financial and cost models (including LRIC and WACC), demand forecasting, techno-economic models, benchmarking, tariff and pricing reviews.
5. Transactions: commercial, technical and vendor due diligence, M&A and transaction support, valuation, privatisation, divestment.
6. Fixed, fibre and broadband: national broadband plans and strategies, feasibility studies, FTTH/FTTx, fixed wireless access, open access networks, backbone and submarine cable, rural connectivity, PPP structures.
7. Infrastructure sharing and towers: TowerCo strategy, passive and active sharing, RAN sharing (MORAN/MOCN), colocation, sale and leaseback, master lease agreements.
8. Licensing and capacity building: licence applications, greenfield and new operator licences, spectrum management training, telecoms training and mini-MBAs, workshops, knowledge transfer.

THREE KINDS OF NOTICE, all of which can be worth flagging:

A. TENDER — a procurement Coleago could bid for: an RFP, ITT, EOI, RFQ, call for proposals, prequalification, or any invitation to supply consultancy, advisory, study, modelling or training services. Set "type" to "tender".

B. CONSULTATION — a public consultation, call for comments, draft regulation or discussion paper. IMPORTANT: Coleago does NOT respond to public consultations, so these are never bid opportunities. Treat them purely as a signal that something is happening in that country which Coleago could advise an operator or regulator on. Judge them ONLY on whether the SUBJECT MATTER falls within Coleago's work above. A consultation on spectrum awards, licence fees, market reviews or interconnection is valuable intelligence and should score well. A consultation on unrelated matters — consumer complaints handling, postal services, broadcasting content, staff regulations, cybersecurity rules, data protection, general administrative procedure — is NOT relevant and must be scored 0-20 and disregarded, however officially it is worded. Set "type" to "consultation".

C. INTELLIGENCE — news or an announcement that is not a procurement at all, but signals work coming: an upcoming or planned spectrum auction, a licence due for renewal, a new national broadband or 5G plan, a merger or privatisation, a new licensing framework, a regulator announcing a market review or a band being released. Coleago can approach the regulator or operators off the back of these. Score these on how strongly they signal advisory work Coleago could win. Set "type" to "intelligence".

DATES — CHECK THESE CAREFULLY. Today's date is given in the message.
- If the notice states a submission deadline, closing date, bid date or similar and that date has ALREADY PASSED, it is dead. Score it 0-10, set "expired" to true, and say so in the rationale.
- If the notice was clearly published or dated more than ONE YEAR before today, it is stale. Score it 0-10, set "expired" to true.
- If no date is given, do not assume it is expired. Set "expired" to false and judge it normally.
- Never treat a FUTURE date as expired.

HOW TO SCORE (after the date check)
85-100: squarely within Coleago's areas — a tender for spectrum, auction, valuation, regulatory or telecoms strategy work, or a strong intelligence signal such as an announced spectrum auction.
70-84: consultancy, advisory, study, modelling or training work in telecoms or digital infrastructure Coleago could credibly bid for, or a consultation whose subject matter is clearly within their areas.
40-69: telecoms-related but the scope is unclear, small, or only loosely advisory.
0-30: not relevant. Equipment or hardware supply, construction and civil works, cabling, vehicles, cleaning, catering, security, generic staffing, office IT, software licences, routine administrative notices, staff appointments, or a consultation on subject matter outside Coleago's work.

Judge the substance, not the wording. A notice that merely mentions telecoms while procuring furniture is not relevant. A notice seeking an adviser, consultant or expert to carry out a study, valuation, model or strategy in this sector is relevant even if it never uses the word "consultancy".`,
  threshold: 60,
  keywords: ["tender", "bid", "rfp", "rfq", "rfa", "rfi", "eoi", "ifb", "itt", "proposal", "quotation", "quote", "procure", "purchas", "solicitation", "prequalif", "pre-qualif", "shortlist", "award", "contract", "closing date", "deadline", "expression of interest", "invitation", "terms of reference", "scope of work", "statement of work", "framework agreement", "framework contract", "competitive dialogue", "notice of intended procurement", "call for", "request for", "submission", "consult", "advisor", "advisory", "expert", "specialist", "technical assistance", "tor", "spectrum", "frequenc", "radio spectrum", "mhz", "ghz", "mmwave", "millimet", "sub-1", "low-band", "mid-band", "high-band", "band", "refarm", "re-farm", "reserve price", "technology neutral", "technology-neutral", "unified licen", "licen", "imt", "wrc", "world radiocommunication", "digital dividend", "digital switchover", "uhf", "auction", "bidder", "bidding", "bid book", "bid team", "sealed bid", "sealed-bid", "clock", "combinatorial", "smra", "cca", "beauty parade", "beauty contest", "comparative selection", "comparative tender", "information memorandum", "war gaming", "mock auction", "5g", "4g", "lte", "network", "sharing", "ran", "moran", "mocn", "towerco", "tower company", "tower", "colocation", "co-location", "passive infrastructure", "site sharing", "sale and leaseback", "sale-and-leaseback", "master lease", "build-to-suit", "fibre", "fiber", "ftth", "fttx", "fttp", "fwa", "fixed wireless", "open access", "open-access", "backbone", "submarine cable", "subsea", "last mile", "middle mile", "broadband", "rural connectivity", "rural broadband", "satellite", "mvno", "roaming", "interconnect", "termination rate", "numbering", "coverage", "quality of service", "qos", "regulat", "policy", "advocacy", "lobbying", "position paper", "expert witness", "expert report", "litigation support", "competition", "margin squeeze", "universal service", "universal access", "digital divide", "connectivity gap", "tariff", "pricing", "cost model", "wacc", "benchmark", "licence condition", "licence obligation", "public consultation", "consultation response", "market review", "sector review", "valuation", "enterprise value", "due diligence", "m&a", "merger", "acquisition", "divest", "disposal", "sell-side", "privatis", "privatiz", "transaction", "business plan", "business case", "feasibility", "financial model", "model", "forecast", "demand", "market", "techno-economic", "strateg", "licensing framework", "licensing review", "review", "assessment", "analys", "audit", "roadmap", "impact", "study", "studies", "business model", "licence application", "license application", "greenfield", "new operator", "capacity building", "training", "workshop", "seminar", "mini-mba", "knowledge transfer", "itu", "gsma", "world bank", "ifc", "crasa", "cept", "dg connect", "development finance", "appel d", "offre", "soumission", "marché", "marche", "adjudication", "attribution", "manifestation", "candidature", "préqualif", "cahier des charges", "termes de référence", "termes de reference", "consultation", "consultant", "conseil", "assistance technique", "date limite", "avis", "accord-cadre", "spectre", "fréquence", "frequence", "enchère", "enchere", "licence", "bande", "prix de réserve", "prix de reserve", "attribution de fréquences", "réaménagement", "reamenagement", "réseau", "reseau", "partage", "mutualisation", "haut débit", "haut debit", "tour", "pylône", "pylone", "itinérance", "itinerance", "interconnexion", "couverture", "tarif", "évaluation", "evaluation", "valorisation", "modèle", "modele", "coût", "cout", "prévision", "prevision", "réglementation", "reglementation", "régulation", "regulation", "politique", "demande", "concurrence", "faisabilité", "faisabilite", "diligence", "stratégie", "strategie", "étude", "etude", "examen", "analyse", "plaidoyer", "formation", "renforcement", "atelier", "numérique", "numerique", "télécom", "telecom", "cession", "fusion", "privatisation", "service universel", "licitación", "licitacion", "concurso", "convocatoria", "oferta", "pliego", "propuesta", "adjudicación", "adjudicacion", "contratación", "contratacion", "precalific", "términos de referencia", "terminos de referencia", "manifestación", "manifestacion", "consultoría", "consultoria", "consultor", "asesor", "experto", "asistencia técnica", "fecha límite", "fecha limite", "aviso", "subasta", "precio de reserva", "acuerdo marco", "espectro", "frecuencia", "licencia", "banda", "red", "compartición", "comparticion", "banda ancha", "fibra", "torre", "satélite", "satelite", "itinerancia", "interconexión", "interconexion", "cobertura", "tarifa", "valoración", "valoracion", "valuación", "valuacion", "modelo", "costo", "coste", "previsión", "regulación", "regulacion", "normativa", "política", "politica", "mercado", "demanda", "competencia", "viabilidad", "diligencia", "estrategia", "estudio", "revisión", "revision", "análisis", "analisis", "auditoría", "auditoria", "formación", "formacion", "capacitación", "capacitacion", "taller", "digital", "fusión", "adquisición", "adquisicion", "privatización", "privatizacion", "servicio universal", "refarming", "edital", "licitação", "licitacao", "proposta", "adjudicação", "adjudicacao", "aquisição", "aquisicao", "pré-qualific", "pre-qualific", "termos de referência", "termos de referencia", "manifestação", "manifestacao", "assessor", "perito", "assistência técnica", "assistencia tecnica", "prazo", "leilão", "leilao", "preço de reserva", "preco de reserva", "acordo-quadro", "frequência", "frequencia", "licença", "licenca", "rede", "partilha", "banda larga", "itinerância", "interligação", "interligacao", "avaliação", "avaliacao", "custo", "previsão", "previsao", "regulamentação", "regulamentacao", "regulação", "regulacao", "procura", "concorrência", "concorrencia", "viabilidade", "diligência", "estratégia", "estudo", "revisão", "revisao", "análise", "analise", "formação", "formacao", "capacitação", "capacitacao", "oficina", "fusão", "fusao", "privatização", "privatizacao", "serviço universal", "servico universal", "gara", "bando", "appalto", "offerta", "aggiudicazione", "affidamento", "manifestazione", "prequalific", "capitolato", "termini di riferimento", "consulenza", "consulente", "esperto", "assistenza tecnica", "scadenza", "avviso", "asta", "prezzo di riserva", "accordo quadro", "spettro", "frequenz", "licenza", "rete", "condivisione", "interconnessione", "copertura", "tariffa", "valutazione", "modello", "previsione", "regolamentazione", "regolazione", "mercato", "domanda", "concorrenza", "fattibilità", "fattibilita", "diligenza", "strategia", "studio", "revisione", "analisi", "verifica", "formazione", "laboratorio", "digitale", "fusione", "acquisizione", "privatizzazione", "servizio universale", "ausschreibung", "vergabe", "angebot", "bieter", "zuschlag", "auftrag", "beschaffung", "präqualif", "praequalif", "interessenbekundung", "leistungsbeschreibung", "rahmenvertrag", "beratung", "berater", "gutachten", "sachverständ", "technische hilfe", "frist", "bekanntmachung", "auktion", "versteigerung", "mindestpreis", "spektrum", "lizenz", "netz", "gemeinsame nutzung", "mitnutzung", "breitband", "glasfaser", "turm", "mast", "satellit", "zusammenschaltung", "abdeckung", "bewertung", "modell", "kosten", "prognose", "regulierung", "politik", "markt", "nachfrage", "wettbewerb", "machbarkeit", "sorgfaltsprüfung", "studie", "überprüfung", "ueberpruefung", "prüfung", "schulung", "weiterbildung", "telekom", "übernahme", "privatisierung", "universaldienst", "aanbesteding", "inschrijving", "advies", "onderzoek", "ihale", "teklif", "danışmanlık", "danismanlik", "etüt", "przetarg", "doradztwo", "widmo", "upphandling", "anbud", "udbud", "hankinta", "tilbud", "lelang", "pengadaan", "konsultasi", "penawaran", "zabuni", "ushauri", "utafiti", "đấu thầu", "dau thau", "tư vấn", "licitácia", "veřejná zakázka", "javna nabava", "nabavka", "ajánlat", "közbeszerzés", "licitatie", "achizi"],
  logAll: true, // VERIFICATION MODE: record every notification, not just the keepers
  // Bump this whenever the built-in keyword list changes. Saved settings with an
  // older stamp automatically pick up the new list, so the default really is the default.
  keywordsVersion: 3,
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
// A stable fingerprint of a notification, used to spot repeats.
// Normalises whitespace, strips dates/numbers that shift between checks, and
// lowercases, so the same notice re-appearing produces the same fingerprint.
function fingerprint(source, text) {
  const norm = String(text || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\d{1,4}[\/\-.]\d{1,2}[\/\-.]\d{1,4}/g, '')  // dates
    .replace(/\d+/g, '')                                    // any other digits
    .replace(/[^\p{L} ]/gu, '')                              // punctuation
    .trim()
    .slice(0, 600);
  const basis = String(source || '').toLowerCase() + '|' + norm;
  // Simple, fast 53-bit hash (cyrb53). No crypto import needed.
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < basis.length; i++) {
    const ch = basis.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// Has this exact notice been seen before? Records the fingerprint either way.
// Returns { seen, count, firstSeen, lastSeen }.
async function checkSeen(fp) {
  const key = 'coleago:seen';
  try {
    const raw = await redis(['HGET', key, fp]);
    const now = new Date().toISOString();
    if (raw) {
      const prev = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const next = { ...prev, count: (prev.count || 1) + 1, lastSeen: now };
      await redis(['HSET', key, fp, JSON.stringify(next)]);
      return { seen: true, ...next };
    }
    await redis(['HSET', key, fp, JSON.stringify({ count: 1, firstSeen: now, lastSeen: now })]);
    return { seen: false, count: 1, firstSeen: now, lastSeen: now };
  } catch (e) {
    return { seen: false, count: 1 }; // storage trouble must never block a real tender
  }
}

async function record(entry) {
  try {
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const full = { id, opened: false, starred: false, ...entry };
    await redis(['HSET', 'coleago:records', id, JSON.stringify(full)]);
  } catch (e) {
    console.log('could not save record:', String(e.message || e));
  }
}

// Escapes a term for use in a regular expression.
function esc(t) { return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

// Matches a term at the START of a word, so stems expand naturally
// ("consult" catches consultancy/consultant/consulting) while short terms
// no longer match inside unrelated words ("tor" will not match "regulator").
function matchesTerm(hay, term) {
  const t = String(term || '').toLowerCase().trim();
  if (!t) return false;
  try {
    return new RegExp('(^|[^\\p{L}])' + esc(t), 'u').test(hay);
  } catch (e) {
    return hay.includes(t); // very old runtimes
  }
}

// Very small language check: are enough common function words present from the
// six languages the keyword list covers? If not, we assume it is some other
// language and send it to the AI instead of discarding it.
const COVERED_STOPWORDS = [
  // English
  'the','and','for','with','shall','will','been','this','that','from',
  // French
  'les','des','une','pour','dans','avec','est','sont','sur','par','cette',
  // Spanish
  'los','las','una','para','con','por','del','que','como','este',
  // Portuguese
  'uma','para','com','dos','das','pelo','pela','este','nao',
  // Italian
  'gli','delle','della','per','con','sono','questo','alla','nel',
  // German
  'der','die','das','und','fur','von','mit','ist','sind','eine','den','auf',
];

function looksLikeCoveredLanguage(hay) {
  let hits = 0;
  for (const w of COVERED_STOPWORDS) {
    if (new RegExp('(^|[^\\p{L}])' + w + '([^\\p{L}]|$)', 'u').test(hay)) {
      hits++;
      if (hits >= 2) return true;
    }
  }
  return false;
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
    if (saved) {
      const parsed = JSON.parse(saved);
      settings = { ...DEFAULTS, ...parsed };
      // An older saved keyword list is superseded by the built-in one.
      if (Number(parsed.keywordsVersion || 0) < Number(DEFAULTS.keywordsVersion || 0)) {
        settings.keywords = DEFAULTS.keywords;
      }
    }
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

  // (a) Scripts that Latin keywords could never match: always let the AI read it.
  const nonLatin = /[\u0600-\u06FF\u0400-\u04FF\u0370-\u03FF\u0590-\u05FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0E00-\u0E7F\u0900-\u097F\u1200-\u137F]/.test(text);

  // (b) Latin script, but not one of the six languages the keyword list covers
  //     (English, French, Spanish, Portuguese, Italian, German) -> also let the
  //     AI read it, rather than discarding a language we have no keywords for.
  const known = !nonLatin && looksLikeCoveredLanguage(hay);

  // (c) Otherwise require an actual keyword, matched at the start of a word so
  //     that stems work ("consult" -> consultancy) without false hits
  //     ("tor" must not match "regulator").
  const hasKeyword = list.some((k) => matchesTerm(hay, k));

  const matched = list.length === 0 || nonLatin || !known || hasKeyword;
  if (!matched) {
    console.log('INGEST no-keyword |', source, url);
    if (!isTest) await bump({ gated: 1 });
    if (logAll && !isTest) await record({ ...base, status: 'no-keyword', title: '(no tender keywords)' });
    return res.status(200).json({ skipped: true, reason: 'no keyword match', source, url });
  }

  // --- REPEAT CHECK: has this exact notice already been through? ---
  // Runs before the AI, so repeats cost nothing.
  const fp = fingerprint(source, text);
  if (!isTest) {
    // Explicitly binned before? Never show it again.
    try {
      const blocked = await redis(['HGET', 'coleago:blocked', fp]);
      if (blocked) {
        console.log('INGEST blocked |', source);
        await bump({ repeats: 1 }, source);
        return res.status(200).json({ skipped: true, reason: 'previously removed', source, url });
      }
    } catch (e) { /* storage trouble must not block a real tender */ }

    const seen = await checkSeen(fp);
    if (seen.seen) {
      console.log('INGEST repeat |', source, '| seen', seen.count, 'times');
      await bump({ repeats: 1 }, source);
      return res.status(200).json({
        skipped: true, reason: 'already seen', seenCount: seen.count,
        firstSeen: seen.firstSeen, source, url,
      });
    }
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
{"title":"","type":"","category":"","deadline":"","posted":"","expired":false,"score":0,"rationale":"","language":""}
"title", "category" and "rationale" must be in English.
"type" is exactly one of "tender", "consultation" or "intelligence".
"deadline" is the submission or closing date as YYYY-MM-DD if one is given, otherwise "".
"posted" is the publication date as YYYY-MM-DD if one is given, otherwise "".
"expired" is true if the deadline has passed or the notice is more than a year old.
"language" is the English name of the original language, or "English".
score is 0-100. Never invent details not in the text.`,
        messages: [{
          role: 'user',
          content: `Today's date is ${new Date().toISOString().slice(0, 10)}. Use it for every date check.\n\nSource: ${source}\nPage: ${url}\n\nChanged text:\n${text.slice(0, 6000)}`,
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

  // Backstop the model's date check in code, so an expired notice can never be kept.
  const todayStr = new Date().toISOString().slice(0, 10);
  const yearAgo = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const isDate = (d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
  if (isDate(verdict.deadline) && verdict.deadline < todayStr) verdict.expired = true;
  if (isDate(verdict.posted) && verdict.posted < yearAgo) verdict.expired = true;

  verdict.relevant = !verdict.expired &&
    Number(verdict.score || 0) >= Number(settings.threshold || 60);
  console.log('INGEST', verdict.relevant ? 'KEPT' : 'dropped', '| score', verdict.score, '|', source);

  if (!isTest) {
    await bump({
      judged: 1,
      kept: verdict.relevant ? 1 : 0,
      expired: verdict.expired ? 1 : 0,
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
      status: verdict.relevant ? 'kept' : (verdict.expired ? 'expired' : 'dropped'),
      inTokens: Number(usage.input_tokens || 0),
      outTokens: Number(usage.output_tokens || 0),
      fp,
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
