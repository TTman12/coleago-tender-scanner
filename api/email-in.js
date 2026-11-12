// EMAIL IN. Emails arrive here (from the intake inbox script, or any inbound-email
// service that posts JSON) and flow through the same judge, dashboard and digest
// as everything else.
//
// Two kinds of email:
//   1. DevelopmentAid tender alerts. One email holds many tenders, so it is split
//      into one item per tender and each is judged on its own.
//   2. Anything else (regulator newsletters etc). Sent through whole, as before.
//
// Self-contained on purpose: no imports.

function strip(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Newsletters carry a lot of boilerplate. Drop the obvious lines so the judge
// reads the actual content rather than unsubscribe footers.
function tidy(text) {
  const junk = /^(unsubscribe|view (this )?(email )?in browser|manage (your )?(preferences|subscription)|privacy policy|copyright|all rights reserved|follow us|sent to |if you no longer|update your preferences|©)/i;
  return String(text || '')
    .split('\n')
    .filter((line) => {
      const l = line.trim();
      if (!l) return true;
      if (junk.test(l)) return false;
      if (l.length < 3) return false;
      return true;
    })
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------
// DevelopmentAid parsing
// ---------------------------------------------------------------------------

// A DevelopmentAid alert is a list of blocks like:
//
//   Title of the tender <https://www.developmentaid.org/tenders/view/1714487/slug?utm...>
//   new            (or "updated")
//   Funding agency: ...
//   Location: ...
//   Sectors: ...
//   Category: ...        (older emails say "Contract type:")
//   Budget: ...
//   Deadline: ...
//
// The fields may sit on one line ("Funding agency: X") or the label may be on its
// own line with the value on the next, depending on how the email was forwarded.

export function isDevAidEmail({ from = '', subject = '', text = '' } = {}) {
  const f = String(from).toLowerCase();
  const s = String(subject).toLowerCase();
  if (f.includes('developmentaid')) return true;
  if (/funding opportunit(y|ies) from developmentaid/.test(s)) return true;
  // Forwarded by a person: the original sender is quoted in the body.
  return /from:\s*developmentaid/i.test(text) || /developmentaid\.org\/tenders\/view\//i.test(text);
}

// Removes tracking parameters (they identify the recipient) and keeps the plain
// tender address, which also gives a stable id.
function cleanTenderUrl(u) {
  const m = String(u || '').match(/https?:\/\/(?:www\.)?developmentaid\.org\/tenders\/view\/(\d+)(?:\/([\w-]+))?/i);
  if (!m) return { url: '', id: '' };
  return {
    id: m[1],
    url: 'https://www.developmentaid.org/tenders/view/' + m[1] + (m[2] ? '/' + m[2] : ''),
  };
}

const LABELS = ['Funding agency', 'Location', 'Sectors', 'Category', 'Contract type', 'Budget', 'Deadline'];

export function parseDevAid(raw) {
  // Work from the plain text. Put each link on its own line after the title.
  const text = String(raw || '').replace(/\r/g, '');
  const lines = text.split('\n').map((l) => l.trim());

  // Find every tender title: a line that carries a link to /tenders/view/<id>.
  // (Text and link may be on one line, as "Title <url>", or the link may be alone.)
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const m = l.match(/(.*?)\s*<?\s*(https?:\/\/(?:www\.)?developmentaid\.org\/tenders\/view\/\d+[^\s>]*)\s*>?/i);
    if (!m) continue;
    let title = m[1].trim();
    // If the link stands alone, the title is the nearest non-empty line above.
    if (!title) {
      for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
        if (lines[j] && !/^(new|updated|open)$/i.test(lines[j])) { title = lines[j]; break; }
      }
    }
    starts.push({ i, title, link: m[2] });
  }

  const tenders = [];
  const seenIds = new Set();
  for (let k = 0; k < starts.length; k++) {
    const { i, title, link } = starts[k];
    const end = k + 1 < starts.length ? starts[k + 1].i : lines.length;
    const block = lines.slice(i + 1, end);

    const { id, url } = cleanTenderUrl(link);
    if (!id || seenIds.has(id)) continue;
    seenIds.add(id);

    const fields = {};
    let status = '';
    for (let b = 0; b < block.length; b++) {
      const line = block[b];
      if (!status && /^(new|updated)$/i.test(line)) { status = line.toLowerCase(); continue; }
      for (const label of LABELS) {
        const re = new RegExp('^' + label + '\\s*:\\s*(.*)$', 'i');
        const lm = line.match(re);
        if (!lm) continue;
        let val = lm[1].trim();
        if (!val) {
          // value is on the next non-empty line
          for (let n = b + 1; n < block.length; n++) {
            if (block[n]) { val = block[n]; break; }
          }
        }
        // drop a trailing link
        val = val.replace(/\s*<https?:[^>]*>?/g, '').trim();
        const key = label === 'Contract type' ? 'Category' : label;
        if (val && !fields[key]) fields[key] = val;
        break;
      }
    }

    // A block with no fields is not a tender (e.g. a banner link).
    if (!fields['Funding agency'] && !fields.Deadline && !fields.Location) continue;

    tenders.push({ id, url, title, status, ...fields });
  }
  return tenders;
}

// Turns one parsed tender into the text the judge reads.
function tenderToText(t) {
  const parts = [t.title];
  if (t.status) parts.push('Status: ' + t.status);
  if (t['Funding agency']) parts.push('Funding agency: ' + t['Funding agency']);
  if (t.Location) parts.push('Location: ' + t.Location);
  if (t.Sectors) parts.push('Sectors: ' + t.Sectors);
  if (t.Category) parts.push('Category: ' + t.Category);
  if (t.Budget) parts.push('Budget: ' + t.Budget);
  if (t.Deadline) parts.push('Deadline: ' + t.Deadline);
  parts.push(
    'Note: this is a headline summary from a DevelopmentAid alert email. Only the details above are available; ' +
    'the full notice is behind a login. Judge on what is shown. If the title is vague but the sector, ' +
    'country or funder could fit, say so in the rationale rather than scoring it zero.'
  );
  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// TendersInfo parsing
// ---------------------------------------------------------------------------

// A TendersInfo alert opens with a summary list, then a "Tender Details" section
// where each tender looks like:
//
//   12. Japan -Consulting services for the current assessment of ...<https://tendersinfo.net/TenderDetail/Tenderinformation?tenderNo=104460235&...>
//   Ref 102063427
//   Org City Of Stratford
//   Country Canada
//   Tender Value Refer Document
//   Notice No rft-2026-18
//   Source Link<https://original-notice-site/...>
//   Deadline 25-11-2026
//   Description Tenders Are Invited For ...
//   [Go Top]
//
// The summary list repeats the titles without links, so it is ignored.

export function isTendersInfoEmail({ from = '', subject = '', text = '' } = {}) {
  const f = String(from).toLowerCase();
  const s = String(subject).toLowerCase();
  if (f.includes('tendersinfo')) return true;
  if (/tenders of your category|tendersinfo/.test(s)) return true;
  return /tendersinfo\.net\/TenderDetail/i.test(text);
}

const TI_FIELDS = ['Ref', 'Org', 'Address', 'Country', 'Bid Type', 'Location', 'Tender Value', 'Emd', 'Notice No', 'Deadline'];

export function parseTendersInfo(raw) {
  const lines = String(raw || '').replace(/\r/g, '').split('\n').map((l) => l.trim());
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\d+\.\s*(.*?)\s*<?(https?:\/\/(?:www\.)?tendersinfo\.net\/TenderDetail\/[^\s>]*)>?\s*$/i);
    if (m) starts.push({ i, title: m[1].trim(), link: m[2] });
  }

  const tenders = [];
  const seen = new Set();
  for (let k = 0; k < starts.length; k++) {
    const { i, title, link } = starts[k];
    const end = k + 1 < starts.length ? starts[k + 1].i : lines.length;
    const idm = link.match(/tenderNo=(\d+)/i);
    const id = idm ? idm[1] : '';
    if (!id || seen.has(id)) continue;
    seen.add(id);

    const t = { id, title };
    let inDesc = false;
    const desc = [];
    for (const line of lines.slice(i + 1, end)) {
      if (/^\[go top\]/i.test(line)) break;
      if (inDesc) { if (line) desc.push(line); continue; }
      const src = line.match(/^Source Link\s*<([^>]*)>?/i);
      if (src) { t.sourceUrl = src[1].trim(); continue; }
      if (/^Docs\b/i.test(line)) continue;
      const dm = line.match(/^Description\s*(.*)$/i);
      if (dm) { inDesc = true; if (dm[1]) desc.push(dm[1]); continue; }
      for (const f of TI_FIELDS) {
        const fm = line.match(new RegExp('^' + f + '\\b\\s*(.*)$', 'i'));
        if (fm) { if (fm[1].trim() && !t[f]) t[f] = fm[1].trim(); break; }
      }
    }
    // Some fields carry translation-service debris; drop it.
    for (const f of TI_FIELDS) if (t[f] && /Detected_Language|Translated_Text/.test(t[f])) delete t[f];
    t.description = desc.join(' ').replace(/\s+/g, ' ').replace(/\{[^}]*Detected_Language[^}]*\}/g, '').trim();
    tenders.push(t);
  }
  return tenders;
}

function tendersInfoToText(t) {
  const parts = [t.title];
  if (t.Org) parts.push('Organisation: ' + t.Org);
  if (t.Country) parts.push('Country: ' + t.Country);
  if (t['Tender Value'] && !/refer document/i.test(t['Tender Value'])) parts.push('Value: ' + t['Tender Value']);
  if (t.Ref) parts.push('Reference: ' + t.Ref);
  if (t.Deadline) parts.push('Deadline: ' + t.Deadline);
  if (t.description) parts.push('Description: ' + t.description);
  parts.push(
    'Note: this is a short summary from an alert email, and the description may be cut off. ' +
    'Judge on what is shown. If it is vague but the subject area could fit, say so in the rationale rather than scoring it zero.'
  );
  return parts.join('\n');
}

// A deadline already in the past is dropped here, before it costs a judge call.
// Understands "26 Oct, 2026" (DevelopmentAid) and "25-11-2026" (TendersInfo).
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseDeadline(s) {
  const str = String(s || '');
  let m = str.match(/(\d{1,2})\s+([A-Za-z]{3,9})\.?,?\s+(\d{4})/);
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon === undefined) return null;
    return new Date(Date.UTC(+m[3], mon, +m[1], 23, 59, 59));
  }
  m = str.match(/(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], 23, 59, 59));
  return null;
}

// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  try {
    // Same shared secret as the change detector.
    const secret = process.env.INGEST_SECRET;
    const headerAuth = (req.headers.authorization || '').replace('Bearer ', '').trim();
    const queryAuth = ((req.query && req.query.key) || '').toString().trim();
    if (!secret || (headerAuth !== secret && queryAuth !== secret)) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    let body = req.body;
    if (body == null) body = {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = { text: body }; }
    }
    if (Array.isArray(body)) body = body[0] || {};
    if (typeof body !== 'object') body = {};

    // Accept the field names used by the common inbound-email services.
    const subject = body.subject || body.Subject || body.headers?.subject || '';
    const from = body.from || body.From || body.sender || body.envelope?.from || '';
    const rawText = body.text || body['body-plain'] || body.TextBody || body.plain || '';
    const rawHtml = body.html || body['body-html'] || body.HtmlBody || '';

    let content = String(rawText || '').trim();
    if (!content && rawHtml) content = strip(rawHtml);

    const host = req.headers.host ? 'https://' + req.headers.host : (process.env.APP_URL || '');
    const send = (payload) =>
      fetch(host + '/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
        body: JSON.stringify(payload),
      }).then((r) => r.json().catch(() => ({})));

    // --- Tender alert (DevelopmentAid or TendersInfo): one judged item per tender ---
    const isTI = isTendersInfoEmail({ from, subject, text: content });
    const isDA = !isTI && isDevAidEmail({ from, subject, text: content });
    if (isTI || isDA) {
      const provider = isTI ? 'TendersInfo' : 'DevelopmentAid';
      const tenders = isTI ? parseTendersInfo(content) : parseDevAid(content);
      const start = Math.max(0, parseInt(body.start, 10) || 0);
      // An email can hold 180+ tenders, and a serverless call is time-limited, so the
      // caller works through it in chunks: send the same email again with start=next.
      const limit = Math.min(20, Math.max(1, parseInt(body.limit, 10) || 8));

      if (tenders.length === 0) {
        // The format may have changed. Say so loudly rather than silently losing tenders.
        if (start === 0) {
          await send({
            source: provider + ' (parser)',
            url: '',
            changed_text: 'PARSER WARNING: a ' + provider + ' email arrived but no tenders could be read from it. ' +
              'The email format may have changed. Subject: ' + subject,
          });
        }
        return res.status(200).json({ received: true, kind: provider.toLowerCase(), total: 0, next: null, warning: 'no tenders parsed' });
      }

      const now = new Date();
      const chunk = tenders.slice(start, start + limit);
      const outcomes = await Promise.all(chunk.map(async (t) => {
        const dl = parseDeadline(isTI ? t.Deadline : t.Deadline);
        if (dl && dl < now) return { id: t.id, expired: true };
        const r = await send({
          source: provider,
          // TendersInfo links to the original notice, which is free to read.
          url: isTI ? (t.sourceUrl || '') : t.url,
          changed_text: isTI ? tendersInfoToText(t) : tenderToText(t),
        });
        return { id: t.id, skipped: !!r.skipped, reason: r.reason || '', score: r.verdict ? r.verdict.score : undefined };
      }));

      const nextStart = start + chunk.length;
      return res.status(200).json({
        received: true, kind: provider.toLowerCase(),
        total: tenders.length, start, processed: chunk.length,
        expired: outcomes.filter((o) => o.expired).length,
        next: nextStart < tenders.length ? nextStart : null,
        results: outcomes,
      });
    }

    // --- Anything else: the whole email, as before ---
    content = tidy(content);
    if (!content && !subject) {
      return res.status(200).json({ skipped: true, reason: 'nothing in the email' });
    }

    // Name the sender as the source, so the dashboard shows where it came from.
    const senderName = String(from).replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
    const domain = (String(from).match(/@([\w.-]+)/) || [])[1] || '';
    const source = (senderName || domain || 'Email') + (domain && senderName ? ' (' + domain + ')' : '');

    // Subject first: it usually carries the headline, and the judge reads from the top.
    const changed_text = (subject ? subject + '\n\n' : '') + content;
    const result = await send({
      source: 'Newsletter: ' + source,
      url: body.url || '',
      changed_text,
    });

    return res.status(200).json({ received: true, source, chars: changed_text.length, result });
  } catch (e) {
    // Inbound mail services retry on errors, so always answer 200.
    return res.status(200).json({ skipped: true, reason: 'email-in error', detail: String(e.message || e) });
  }
}
