// Reads and saves the judging parameters shown on the dashboard.
// Self-contained on purpose: no imports.

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
    // ?defaults=1 returns the built-in list, ignoring anything saved.
    if (req.query && (req.query.defaults === '1' || req.query.defaults === 'true')) {
      return res.status(200).json(DEFAULTS);
    }
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
