// EMAIL IN. For regulators that cannot be watched by the change detector but do
// send a newsletter or tender alert. Forward those emails here and they flow
// through the same judge, dashboard and digest as everything else.
//
// Works with any inbound-email service that posts JSON (Cloudflare Email
// Workers, Mailgun Routes, SendGrid Inbound Parse, Zapier, Make, Postmark).
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
    content = tidy(content);

    if (!content && !subject) {
      return res.status(200).json({ skipped: true, reason: 'nothing in the email' });
    }

    // Name the sender as the source, so the dashboard shows where it came from.
    const senderName = String(from).replace(/<[^>]*>/g, '').replace(/["']/g, '').trim();
    const domain = (String(from).match(/@([\w.-]+)/) || [])[1] || '';
    const source = (senderName || domain || 'Email') + (domain && senderName ? ' (' + domain + ')' : '');

    // Hand straight to the normal pipeline. Subject first: it usually carries
    // the headline, and the judge reads from the top.
    const changed_text = (subject ? subject + '\n\n' : '') + content;

    const host = req.headers.host ? 'https://' + req.headers.host : (process.env.APP_URL || '');
    const r = await fetch(host + '/api/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + secret },
      body: JSON.stringify({
        source: 'Newsletter: ' + source,
        url: body.url || '',
        changed_text,
      }),
    });
    const result = await r.json().catch(() => ({}));

    return res.status(200).json({ received: true, source, chars: changed_text.length, result });
  } catch (e) {
    // Inbound mail services retry on errors, so always answer 200.
    return res.status(200).json({ skipped: true, reason: 'email-in error', detail: String(e.message || e) });
  }
}
