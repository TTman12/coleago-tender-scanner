// Reads and saves the judging parameters shown on the dashboard.
// Self-contained on purpose: no imports.

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

THREE CATEGORIES. Every relevant notice must be classified as exactly one:

A. TENDER — an actual procurement Coleago can bid for right now: an RFP, ITT, EOI, RFQ, call for proposals, prequalification, or any invitation to supply consultancy, advisory, study, modelling or training services. This is the most important category. Set "type" to "tender".

B. LEAD — something is HAPPENING NOW that Coleago can act on immediately by approaching a regulator or operator. A spectrum auction is under way or has just been announced, a licence is being renewed, a market review has opened, an operator is being privatised or merged, a band is being released, a national plan has just been launched, or a public consultation has opened on a subject within Coleago's work. Not a procurement, but a live reason to make contact today. Set "type" to "lead".

C. INTELLIGENCE — highly relevant, but it concerns something that will happen in the FUTURE rather than now. A regulator states it intends to auction spectrum next year, plans a licensing framework, signals a future band release, or sets out a roadmap or strategy for coming years. Worth knowing and worth tracking, but there is nothing to act on this week. Set "type" to "intelligence".

The difference between LEAD and INTELLIGENCE is timing. If it is live, open, under way or just announced, it is a LEAD. If it is planned, intended, proposed or scheduled for a later period, it is INTELLIGENCE.

PUBLIC CONSULTATIONS. Coleago does NOT respond to public consultations, so they are never tenders. Treat a consultation purely as a signal, and classify it as a LEAD (if it is open now) or INTELLIGENCE (if it concerns something later). Judge it ONLY on whether the SUBJECT MATTER falls within Coleago's work. A consultation on spectrum awards, licence fees, market reviews or interconnection is valuable. A consultation on unrelated matters — consumer complaints handling, postal services, broadcasting content, staff regulations, cybersecurity rules, data protection, general administrative procedure — is NOT relevant and must be scored 0-20, however officially it is worded.

DATES — CHECK THESE CAREFULLY. Today's date is given in the message.
- If the notice states a submission deadline, closing date, bid date or similar and that date has ALREADY PASSED, it is dead. Score it 0-10, set "expired" to true, and say so in the rationale.
- If the notice was clearly published or dated more than ONE YEAR before today, it is stale. Score it 0-10, set "expired" to true.
- If no date is given, do not assume it is expired. Set "expired" to false and judge it normally.
- Never treat a FUTURE date as expired.

HOW TO SCORE (after the date check)
85-100: squarely within Coleago's areas — a tender for spectrum, auction, valuation, regulatory or telecoms strategy work, or a strong lead such as a spectrum auction now under way.
70-84: consultancy, advisory, study, modelling or training work in telecoms or digital infrastructure Coleago could credibly bid for, or a lead or intelligence item whose subject matter is clearly within their areas.
40-69: telecoms-related but the scope is unclear, small, or only loosely advisory.
0-30: not relevant. Equipment or hardware supply, construction and civil works, cabling, vehicles, cleaning, catering, security, generic staffing, office IT, software licences, routine administrative notices, staff appointments, or a consultation on subject matter outside Coleago's work.

Judge the substance, not the wording. A notice that merely mentions telecoms while procuring furniture is not relevant. A notice seeking an adviser, consultant or expert to carry out a study, valuation, model or strategy in this sector is relevant even if it never uses the word "consultancy".`,
  threshold: 60,
  keywords: ["tender", "bid", "rfp", "rfq", "rfa", "rfi", "eoi", "ifb", "itt", "proposal", "quotation", "quote", "procure", "purchas", "solicitation", "prequalif", "pre-qualif", "shortlist", "award", "contract", "closing date", "deadline", "expression of interest", "invitation", "terms of reference", "scope of work", "statement of work", "framework agreement", "framework contract", "competitive dialogue", "notice of intended procurement", "call for", "request for", "submission", "consult", "advisor", "advisory", "expert", "specialist", "technical assistance", "tor", "spectrum", "frequenc", "radio spectrum", "mhz", "ghz", "mmwave", "millimet", "sub-1", "low-band", "mid-band", "high-band", "band", "refarm", "re-farm", "reserve price", "technology neutral", "technology-neutral", "unified licen", "licen", "imt", "wrc", "world radiocommunication", "digital dividend", "digital switchover", "uhf", "auction", "bidder", "bidding", "bid book", "bid team", "sealed bid", "sealed-bid", "clock", "combinatorial", "smra", "cca", "beauty parade", "beauty contest", "comparative selection", "comparative tender", "information memorandum", "war gaming", "mock auction", "5g", "4g", "lte", "network", "sharing", "ran", "moran", "mocn", "towerco", "tower company", "tower", "colocation", "co-location", "passive infrastructure", "site sharing", "sale and leaseback", "sale-and-leaseback", "master lease", "build-to-suit", "fibre", "fiber", "ftth", "fttx", "fttp", "fwa", "fixed wireless", "open access", "open-access", "backbone", "submarine cable", "subsea", "last mile", "middle mile", "broadband", "rural connectivity", "rural broadband", "satellite", "mvno", "roaming", "interconnect", "termination rate", "numbering", "coverage", "quality of service", "qos", "regulat", "policy", "advocacy", "lobbying", "position paper", "expert witness", "expert report", "litigation support", "competition", "margin squeeze", "universal service", "universal access", "digital divide", "connectivity gap", "tariff", "pricing", "cost model", "wacc", "benchmark", "licence condition", "licence obligation", "public consultation", "consultation response", "market review", "sector review", "valuation", "enterprise value", "due diligence", "m&a", "merger", "acquisition", "divest", "disposal", "sell-side", "privatis", "privatiz", "transaction", "business plan", "business case", "feasibility", "financial model", "model", "forecast", "demand", "market", "techno-economic", "strateg", "licensing framework", "licensing review", "review", "assessment", "analys", "audit", "roadmap", "impact", "study", "studies", "business model", "licence application", "license application", "greenfield", "new operator", "capacity building", "training", "workshop", "seminar", "mini-mba", "knowledge transfer", "itu", "gsma", "world bank", "ifc", "crasa", "cept", "dg connect", "development finance", "appel d", "offre", "soumission", "marché", "marche", "adjudication", "attribution", "manifestation", "candidature", "préqualif", "cahier des charges", "termes de référence", "termes de reference", "consultation", "consultant", "conseil", "assistance technique", "date limite", "avis", "accord-cadre", "spectre", "fréquence", "frequence", "enchère", "enchere", "licence", "bande", "prix de réserve", "prix de reserve", "attribution de fréquences", "réaménagement", "reamenagement", "réseau", "reseau", "partage", "mutualisation", "haut débit", "haut debit", "tour", "pylône", "pylone", "itinérance", "itinerance", "interconnexion", "couverture", "tarif", "évaluation", "evaluation", "valorisation", "modèle", "modele", "coût", "cout", "prévision", "prevision", "réglementation", "reglementation", "régulation", "regulation", "politique", "demande", "concurrence", "faisabilité", "faisabilite", "diligence", "stratégie", "strategie", "étude", "etude", "examen", "analyse", "plaidoyer", "formation", "renforcement", "atelier", "numérique", "numerique", "télécom", "telecom", "cession", "fusion", "privatisation", "service universel", "licitación", "licitacion", "concurso", "convocatoria", "oferta", "pliego", "propuesta", "adjudicación", "adjudicacion", "contratación", "contratacion", "precalific", "términos de referencia", "terminos de referencia", "manifestación", "manifestacion", "consultoría", "consultoria", "consultor", "asesor", "experto", "asistencia técnica", "fecha límite", "fecha limite", "aviso", "subasta", "precio de reserva", "acuerdo marco", "espectro", "frecuencia", "licencia", "banda", "red", "compartición", "comparticion", "banda ancha", "fibra", "torre", "satélite", "satelite", "itinerancia", "interconexión", "interconexion", "cobertura", "tarifa", "valoración", "valoracion", "valuación", "valuacion", "modelo", "costo", "coste", "previsión", "regulación", "regulacion", "normativa", "política", "politica", "mercado", "demanda", "competencia", "viabilidad", "diligencia", "estrategia", "estudio", "revisión", "revision", "análisis", "analisis", "auditoría", "auditoria", "formación", "formacion", "capacitación", "capacitacion", "taller", "digital", "fusión", "adquisición", "adquisicion", "privatización", "privatizacion", "servicio universal", "refarming", "edital", "licitação", "licitacao", "proposta", "adjudicação", "adjudicacao", "aquisição", "aquisicao", "pré-qualific", "pre-qualific", "termos de referência", "termos de referencia", "manifestação", "manifestacao", "assessor", "perito", "assistência técnica", "assistencia tecnica", "prazo", "leilão", "leilao", "preço de reserva", "preco de reserva", "acordo-quadro", "frequência", "frequencia", "licença", "licenca", "rede", "partilha", "banda larga", "itinerância", "interligação", "interligacao", "avaliação", "avaliacao", "custo", "previsão", "previsao", "regulamentação", "regulamentacao", "regulação", "regulacao", "procura", "concorrência", "concorrencia", "viabilidade", "diligência", "estratégia", "estudo", "revisão", "revisao", "análise", "analise", "formação", "formacao", "capacitação", "capacitacao", "oficina", "fusão", "fusao", "privatização", "privatizacao", "serviço universal", "servico universal", "gara", "bando", "appalto", "offerta", "aggiudicazione", "affidamento", "manifestazione", "prequalific", "capitolato", "termini di riferimento", "consulenza", "consulente", "esperto", "assistenza tecnica", "scadenza", "avviso", "asta", "prezzo di riserva", "accordo quadro", "spettro", "frequenz", "licenza", "rete", "condivisione", "interconnessione", "copertura", "tariffa", "valutazione", "modello", "previsione", "regolamentazione", "regolazione", "mercato", "domanda", "concorrenza", "fattibilità", "fattibilita", "diligenza", "strategia", "studio", "revisione", "analisi", "verifica", "formazione", "laboratorio", "digitale", "fusione", "acquisizione", "privatizzazione", "servizio universale", "ausschreibung", "vergabe", "angebot", "bieter", "zuschlag", "auftrag", "beschaffung", "präqualif", "praequalif", "interessenbekundung", "leistungsbeschreibung", "rahmenvertrag", "beratung", "berater", "gutachten", "sachverständ", "technische hilfe", "frist", "bekanntmachung", "auktion", "versteigerung", "mindestpreis", "spektrum", "lizenz", "netz", "gemeinsame nutzung", "mitnutzung", "breitband", "glasfaser", "turm", "mast", "satellit", "zusammenschaltung", "abdeckung", "bewertung", "modell", "kosten", "prognose", "regulierung", "politik", "markt", "nachfrage", "wettbewerb", "machbarkeit", "sorgfaltsprüfung", "studie", "überprüfung", "ueberpruefung", "prüfung", "schulung", "weiterbildung", "telekom", "übernahme", "privatisierung", "universaldienst", "aanbesteding", "inschrijving", "advies", "onderzoek", "ihale", "teklif", "danışmanlık", "danismanlik", "etüt", "przetarg", "doradztwo", "widmo", "upphandling", "anbud", "udbud", "hankinta", "tilbud", "lelang", "pengadaan", "konsultasi", "penawaran", "zabuni", "ushauri", "utafiti", "đấu thầu", "dau thau", "tư vấn", "licitácia", "veřejná zakázka", "javna nabava", "nabavka", "ajánlat", "közbeszerzés", "licitatie", "achizi"],
  logAll: true, // VERIFICATION MODE: record every notification, not just the keepers
  // Bump this whenever the built-in keyword list changes. Saved settings with an
  // older stamp automatically pick up the new list, so the default really is the default.
  keywordsVersion: 4,
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
      if (!saved) return res.status(200).json(DEFAULTS);

      const parsed = JSON.parse(saved);
      const merged = { ...DEFAULTS, ...parsed };

      // If the built-in keyword list is newer than the saved one, adopt it and
      // persist, so an updated default list takes effect without any button press.
      if (Number(parsed.keywordsVersion || 0) < Number(DEFAULTS.keywordsVersion || 0)) {
        merged.keywords = DEFAULTS.keywords;
        merged.profile = DEFAULTS.profile; // the rubric changes with the version too
        merged.keywordsVersion = DEFAULTS.keywordsVersion;
        // Persist without the notice flag, so it only shows once.
        const toStore = { ...merged };
        delete toStore._keywordsUpdated;
        delete toStore._warning;
        try { await redis(['SET', 'coleago:settings', JSON.stringify(toStore)]); } catch (e) {}
        merged._keywordsUpdated = true;
      }
      return res.status(200).json(merged);
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
    next.keywordsVersion = DEFAULTS.keywordsVersion;
    try {
      await redis(['SET', 'coleago:settings', JSON.stringify(next)]);
      return res.status(200).json(next);
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  return res.status(405).json({ error: 'Use GET or POST' });
}
