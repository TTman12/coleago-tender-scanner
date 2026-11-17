/**
 * COLEAGO INTAKE: Gmail -> dashboard
 *
 * Lives inside the intake Gmail account (script.google.com while signed in as the
 * intake address). Every few minutes it finds new forwarded alert emails (DevelopmentAid, TendersInfo), sends each to
 * the dashboard's /api/email-in, and labels it "processed" so it is never sent twice.
 *
 * SETUP (once):
 *  1. In the intake account go to script.google.com -> New project, paste this file.
 *  2. Project Settings (gear) -> Script properties -> add:
 *       APP_URL        https://YOUR-SITE.vercel.app      (no trailing slash)
 *       INGEST_SECRET  the same secret as in Vercel
 *  3. Run `processDevAidEmails` once and approve the permissions it asks for.
 *  4. Run `installTrigger` once. It now runs every 5 minutes by itself.
 */

var PROCESSED_LABEL = 'processed';
var CHUNK = 8;          // tenders judged per call (an email can hold 180+)
var MAX_CALLS = 120;    // safety stop per email
var TIME_BUDGET_MS = 4.5 * 60 * 1000; // Apps Script stops at 6 min; save progress before that

function processDevAidEmails() {
  var startedAt = Date.now();
  // Stop a second run starting while a long one is still going.
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) { console.log('Another run is still working, skipping this one.'); return; }
  var props = PropertiesService.getScriptProperties();
  var appUrl = (props.getProperty('APP_URL') || '').replace(/\/$/, '');
  var secret = props.getProperty('INGEST_SECRET');
  if (!appUrl || !secret) throw new Error('Set APP_URL and INGEST_SECRET in Script properties.');

  var label = GmailApp.getUserLabelByName(PROCESSED_LABEL) || GmailApp.createLabel(PROCESSED_LABEL);
  // Everything that lands in this inbox is a forwarded alert, so no keyword filter:
  // forwarded mail comes from the forwarder, not from DevelopmentAid/TendersInfo.
  var threads = GmailApp.search('-label:' + PROCESSED_LABEL + ' newer_than:14d -in:trash -in:spam -in:drafts', 0, 20);
  console.log('Found ' + threads.length + ' unprocessed thread(s).');

  threads.forEach(function (thread) {
    var allOk = true;
    thread.getMessages().forEach(function (msg) {
      var subject = msg.getSubject() || '';
      var from = msg.getFrom() || '';
      var body = msg.getPlainBody() || '';
      var html = msg.getBody() || '';
      // Some alerts arrive with the real content inside an attachment (.eml / .html).
      if (!body && !html) {
        var fromAtt = readAttachments_(msg);
        body = fromAtt.text; html = fromAtt.html;
        console.log('  attachments: ' + fromAtt.info + ' -> plain ' + body.length + ', html ' + html.length);
      }
      // Many alerts are HTML-only: no plain text at all. Only skip if there is neither.
      // Also skip Google's own notices (e.g. forwarding confirmation) and bounces.
      var isGoogleNotice = /@(google|googlemail)\.com/i.test(from) && /forwarding|security alert/i.test(subject + body.slice(0, 300));
      if ((!body && !html) || /^Undeliverable:/i.test(subject) || isGoogleNotice) {
        console.log('Skipped: ' + subject + '  [plain ' + body.length + ' chars, html ' + html.length + ' chars, from ' + from + ', attachments ' + msg.getAttachments().length + ']');
        return;
      }
      var ok = sendEmail_(appUrl, secret, subject, from, body, html, msg.getId(), startedAt);
      console.log((ok ? 'Sent: ' : 'FAILED: ') + subject + '  [plain ' + body.length + ' chars, html ' + html.length + ' chars]');
      if (!ok) allOk = false;
    });
    // Only label when everything went through, so a failure is retried next time.
    // (Repeats are harmless: the dashboard ignores tenders it has already seen.)
    if (allOk) thread.addLabel(label);
  });
}

function sendEmail_(appUrl, secret, subject, from, text, html, msgId, startedAt) {
  // Big alerts (100s of tenders) take several runs: remember how far we got.
  var props = PropertiesService.getScriptProperties();
  var key = 'progress_' + msgId;
  var start = parseInt(props.getProperty(key) || '0', 10) || 0;
  if (start) console.log('  resuming from tender ' + start);
  for (var i = 0; i < MAX_CALLS; i++) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) {
      console.log('  time budget reached at tender ' + start + ', will continue on the next run');
      return false;
    }
    var res = UrlFetchApp.fetch(appUrl + '/api/email-in', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + secret },
      payload: JSON.stringify({ subject: subject, from: from, text: text, html: html, start: start, limit: CHUNK }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      console.error('email-in returned ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
      return false;
    }
    var json = {};
    try { json = JSON.parse(res.getContentText()); } catch (e) { return false; }
    // Say exactly what the site did, so the Execution log is proof.
    if (start === 0) {
      console.log('  -> ' + (json.kind || 'unknown') + ': ' + (json.total !== undefined ? json.total + ' item(s) found' : 'no count') +
        (json.warning ? ' | WARNING: ' + json.warning : '') + (json.reason ? ' | ' + json.reason : ''));
    }
    // A recognised alert with nothing readable in it means the layout is not understood.
    // Do not mark it processed, so it is retried once the reader is fixed.
    if (json.warning || json.reason === 'email-in error') return false;
    // No "next" means that was the last chunk.
    if (json.next === null || json.next === undefined) {
      console.log('  -> done: ' + (json.expired || 0) + ' expired in the last batch');
      props.deleteProperty(key);
      return true;
    }
    start = json.next;
    props.setProperty(key, String(start));
  }
  return false;
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processDevAidEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processDevAidEmails').timeBased().everyMinutes(5).create();
}


// ---- Attachment reading ------------------------------------------------------
function readAttachments_(msg) {
  var out = { text: '', html: '', info: [] };
  msg.getAttachments().forEach(function (att) {
    var name = att.getName() || '', type = (att.getContentType() || '').toLowerCase();
    out.info.push(name + ' (' + type + ', ' + att.getBytes().length + ' bytes)');
    try {
      if (/message\/rfc822/.test(type) || /\.eml$/i.test(name)) {
        var r = parseMime_(att.getDataAsString());
        out.text += r.text; out.html += r.html;
      } else if (/text\/html/.test(type) || /\.html?$/i.test(name)) {
        // The same file often comes attached twice; reading it twice doubles every tender.
        if (!out.html) out.html = att.getDataAsString();
      } else if (/text\/plain/.test(type) || /\.txt$/i.test(name)) {
        out.text += att.getDataAsString();
      }
    } catch (e) { out.info.push('error reading ' + name + ': ' + e); }
  });
  out.info = out.info.join('; ');
  return out;
}

function parseMime_(raw) {
  var res = { text: '', html: '' };
  var m = raw.match(/\r?\n\r?\n/);
  var headEnd = m ? m.index : raw.length;
  var head = raw.slice(0, headEnd).replace(/\r?\n[ \t]+/g, ' ');
  var body = m ? raw.slice(headEnd + m[0].length) : '';
  function hdr(n) { var h = head.match(new RegExp('^' + n + ':\\s*(.*)$', 'im')); return h ? h[1] : ''; }
  var ctype = hdr('Content-Type') || 'text/plain';
  var enc = hdr('Content-Transfer-Encoding').trim().toLowerCase();
  var boundary = (ctype.match(/boundary="?([^";]+)"?/i) || [])[1];
  if (/multipart\//i.test(ctype) && boundary) {
    body.split('--' + boundary).forEach(function (part) {
      if (/^\s*--\s*$/.test(part) || !part.trim()) return;
      var sub = parseMime_(part.replace(/^\r?\n/, ''));
      res.text += sub.text; res.html += sub.html;
    });
    return res;
  }
  if (/message\/rfc822/i.test(ctype)) return parseMime_(body);
  var charset = (ctype.match(/charset="?([^";]+)"?/i) || [, 'UTF-8'])[1];
  var decoded = decodeBody_(body, enc, charset);
  if (/text\/html/i.test(ctype)) res.html = decoded;
  else if (/text\/plain/i.test(ctype)) res.text = decoded;
  return res;
}

function decodeBody_(body, enc, charset) {
  try {
    if (enc === 'base64') {
      return Utilities.newBlob(Utilities.base64Decode(body.replace(/\s+/g, ''))).getDataAsString(charset);
    }
    if (enc === 'quoted-printable') {
      var bytes = [];
      var t = body.replace(/=\r?\n/g, '');
      for (var i = 0; i < t.length; i++) {
        var c = t.charAt(i);
        if (c === '=' && /^[0-9A-Fa-f]{2}$/.test(t.substr(i + 1, 2))) { bytes.push(parseInt(t.substr(i + 1, 2), 16)); i += 2; }
        else { var code = t.charCodeAt(i); if (code < 128) bytes.push(code); else Array.prototype.push.apply(bytes, Utilities.newBlob(c).getBytes()); }
      }
      return Utilities.newBlob(bytes).getDataAsString(charset);
    }
  } catch (e) { /* fall through to raw */ }
  return body;
}
