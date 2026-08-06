// Sends the digest email: everything that has come in since the last send,
// grouped by category, styled like the dashboard, with a link back to it.
// Triggered by the daily cron in vercel.json, or manually from Admin.
// Self-contained on purpose: no imports.

const HASH = 'coleago:records';
const BRAND = '#0E4C8A';
const BRAND_DEEP = '#0A3866';

const TYPES = [
  { key: 'tender',       label: 'Tenders',      blurb: 'Live procurements Coleago can bid for.',                 colour: '#1A7F45', bg: '#E7F3EA' },
  { key: 'lead',         label: 'Leads',        blurb: 'Happening now — worth making contact.',                  colour: '#A66B00', bg: '#FFF3E0' },
  { key: 'intelligence', label: 'Intelligence', blurb: 'Coming later — worth tracking, nothing to do today.',     colour: '#5B3E96', bg: '#EFEAF7' },
];

async function redis(command) {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Storage not connected');
  const r = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

function parse(v) { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } }

function records(flat) {
  const out = [];
  if (!flat) return out;
  if (Array.isArray(flat)) {
    for (let i = 0; i < flat.length; i += 2) {
      const r = parse(flat[i + 1]);
      if (r) { r.id = r.id || flat[i]; out.push(r); }
    }
  } else if (typeof flat === 'object') {
    for (const [k, v] of Object.entries(flat)) {
      const r = parse(v);
      if (r) { r.id = r.id || k; out.push(r); }
    }
  }
  return out;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function card(t, type) {
  const meta = [
    t.source,
    t.category,
    t.deadline ? 'closes ' + t.deadline : '',
    t.language && String(t.language).toLowerCase() !== 'english' ? 'translated from ' + t.language : '',
  ].filter(Boolean).map(esc).join(' &middot; ');

  return `
  <tr><td style="padding:0 0 14px">
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E2E7EC;border-left:4px solid ${type.colour};border-radius:8px">
      <tr><td style="padding:15px 17px;font-family:Segoe UI,system-ui,-apple-system,Arial,sans-serif">
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="font-size:15px;font-weight:600;color:#1B2430;line-height:1.4">${esc(t.title || 'Untitled')}</td>
          <td align="right" style="white-space:nowrap;padding-left:10px">
            <span style="background:${BRAND};color:#fff;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:700">${esc(t.score == null ? '' : t.score)}</span>
          </td>
        </tr></table>
        <div style="font-size:12.5px;color:#5A6675;margin-top:4px">${meta}</div>
        ${t.rationale ? `<div style="font-size:13.5px;color:#1B2430;margin-top:8px;line-height:1.5">${esc(t.rationale)}</div>` : ''}
        ${t.url ? `<div style="margin-top:10px"><a href="${esc(t.url)}" style="color:${BRAND};font-size:13px;text-decoration:none;font-weight:600">Open the source page &rarr;</a></div>` : ''}
      </td></tr>
    </table>
  </td></tr>`;
}

function buildEmail(groups, total, dashboardUrl) {
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const sections = TYPES.map((type) => {
    const items = groups[type.key] || [];
    if (!items.length) return '';
    return `
    <tr><td style="padding:6px 0 10px">
      <table cellpadding="0" cellspacing="0"><tr>
        <td style="background:${type.bg};color:${type.colour};border-radius:5px;padding:3px 10px;font-size:11.5px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;font-family:Segoe UI,system-ui,Arial,sans-serif">${type.label} &middot; ${items.length}</td>
      </tr></table>
      <div style="font-size:12.5px;color:#5A6675;margin-top:7px;font-family:Segoe UI,system-ui,Arial,sans-serif">${type.blurb}</div>
    </td></tr>
    ${items.map((t) => card(t, type)).join('')}`;
  }).join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F7F9FB">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F9FB;padding:24px 12px">
<tr><td align="center">
  <table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;overflow:hidden">

    <tr><td style="background:${BRAND};padding:22px 26px">
      <div style="color:#ffffff;font-size:19px;font-weight:600;font-family:Segoe UI,system-ui,Arial,sans-serif;letter-spacing:-.01em">Coleago Tender Scanner</div>
      <div style="color:rgba(255,255,255,.72);font-size:13px;margin-top:3px;font-family:Segoe UI,system-ui,Arial,sans-serif">${esc(today)} &middot; ${total} new item${total === 1 ? '' : 's'}</div>
    </td></tr>

    <tr><td style="padding:22px 26px 6px">
      <table width="100%" cellpadding="0" cellspacing="0">${sections}</table>
    </td></tr>

    <tr><td align="center" style="padding:10px 26px 26px">
      <a href="${esc(dashboardUrl)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 26px;border-radius:7px;font-size:14.5px;font-weight:600;font-family:Segoe UI,system-ui,Arial,sans-serif">Open the dashboard</a>
    </td></tr>

    <tr><td style="background:#F7F9FB;padding:16px 26px;border-top:1px solid #E2E7EC">
      <div style="font-size:11.5px;color:#8A94A0;font-family:Segoe UI,system-ui,Arial,sans-serif;line-height:1.6">
        Tenders are live procurements to bid for. Leads are happening now and worth a call. Intelligence is coming later and worth tracking.<br>
        Expired notices and anything below the relevance threshold are filtered out automatically.
      </div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

function plainText(groups, total, dashboardUrl) {
  let out = `Coleago Tender Scanner — ${total} new item${total === 1 ? '' : 's'}\n\n`;
  for (const type of TYPES) {
    const items = groups[type.key] || [];
    if (!items.length) continue;
    out += `${type.label.toUpperCase()} (${items.length})\n${type.blurb}\n\n`;
    for (const t of items) {
      out += `- ${t.title || 'Untitled'} [${t.score == null ? '' : t.score}]\n`;
      out += `  ${[t.source, t.category, t.deadline ? 'closes ' + t.deadline : ''].filter(Boolean).join(' | ')}\n`;
      if (t.rationale) out += `  ${t.rationale}\n`;
      if (t.url) out += `  ${t.url}\n`;
      out += '\n';
    }
  }
  out += `Open the dashboard: ${dashboardUrl}\n`;
  return out;
}

export default async function handler(req, res) {
  const q = req.query || {};
  const isPreview = q.preview === '1';
  const force = q.force === '1'; // resend items already emailed (for testing)

  // A manual send from the dashboard must carry the ingest secret.
  // Vercel's cron sends its own authorisation header.
  const secret = process.env.INGEST_SECRET;
  const fromCron = String(req.headers['user-agent'] || '').includes('vercel-cron') ||
    (req.headers.authorization || '') === `Bearer ${process.env.CRON_SECRET || ''}` && !!process.env.CRON_SECRET;
  const key = (q.key || '').toString().trim() ||
    (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!fromCron && (!secret || key !== secret)) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const dashboardUrl = process.env.APP_URL ||
    (req.headers.host ? 'https://' + req.headers.host : 'https://vercel.com');

  try {
    const all = records(await redis(['HGETALL', HASH]));

    // Everything relevant, not binned, not already emailed.
    const fresh = all
      .filter((r) => !r.deletedAt)
      .filter((r) => (r.status || (r.relevant ? 'kept' : '')) === 'kept')
      .filter((r) => force || !r.emailed)
      .sort((a, b) => Number(b.score || 0) - Number(a.score || 0));

    const groups = {};
    for (const t of fresh) {
      const k = TYPES.some((x) => x.key === t.type) ? t.type : 'lead';
      (groups[k] = groups[k] || []).push(t);
    }

    const html = buildEmail(groups, fresh.length, dashboardUrl);

    // Preview in the browser without sending.
    if (isPreview) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(html);
    }

    if (!fresh.length) {
      return res.status(200).json({ sent: false, reason: 'nothing new to report' });
    }
    if (!process.env.RESEND_API_KEY || !process.env.ALERT_EMAIL) {
      return res.status(200).json({
        sent: false,
        reason: 'email is not configured — set RESEND_API_KEY and ALERT_EMAIL',
        wouldHaveSent: fresh.length,
      });
    }

    const to = String(process.env.ALERT_EMAIL).split(',').map((e) => e.trim()).filter(Boolean);
    const counts = TYPES.map((t) => (groups[t.key] || []).length);
    const subject = `Coleago Tender Scanner — ${counts[0]} tender${counts[0] === 1 ? '' : 's'}, ${counts[1]} lead${counts[1] === 1 ? '' : 's'}, ${counts[2]} intelligence`;

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM || 'Tender Scanner <onboarding@resend.dev>',
        to,
        subject,
        html,
        text: plainText(groups, fresh.length, dashboardUrl),
      }),
    });
    const sendResult = await r.json();
    if (!r.ok) {
      return res.status(500).json({ sent: false, error: sendResult.message || 'send failed' });
    }

    // Mark them so the next digest does not repeat them.
    const stamp = new Date().toISOString();
    for (const t of fresh) {
      t.emailed = stamp;
      try { await redis(['HSET', HASH, t.id, JSON.stringify(t)]); } catch (e) {}
    }

    return res.status(200).json({ sent: true, count: fresh.length, to });
  } catch (e) {
    return res.status(500).json({ sent: false, error: String(e.message || e) });
  }
}
