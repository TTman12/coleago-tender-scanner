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
var MAX_CALLS = 40;     // safety stop per email

function processDevAidEmails() {
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
      // Skip Google's own notices (e.g. forwarding confirmation), bounces and empty messages.
      if (!body || /^Undeliverable:/i.test(subject) || /@(google|googlemail)\.com/i.test(from) && /forwarding|security alert/i.test(subject + body.slice(0, 300))) {
        console.log('Skipped: ' + subject);
        return;
      }
      var ok = sendEmail_(appUrl, secret, subject, from, body);
      console.log((ok ? 'Sent: ' : 'FAILED: ') + subject);
      if (!ok) allOk = false;
    });
    // Only label when everything went through, so a failure is retried next time.
    // (Repeats are harmless: the dashboard ignores tenders it has already seen.)
    if (allOk) thread.addLabel(label);
  });
}

function sendEmail_(appUrl, secret, subject, from, text) {
  var start = 0;
  for (var i = 0; i < MAX_CALLS; i++) {
    var res = UrlFetchApp.fetch(appUrl + '/api/email-in', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + secret },
      payload: JSON.stringify({ subject: subject, from: from, text: text, start: start, limit: CHUNK }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      console.error('email-in returned ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
      return false;
    }
    var json = {};
    try { json = JSON.parse(res.getContentText()); } catch (e) { return false; }
    // No "next" means that was the last chunk (or not a DevelopmentAid alert).
    if (json.next === null || json.next === undefined) return true;
    start = json.next;
  }
  return false;
}

function installTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processDevAidEmails') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processDevAidEmails').timeBased().everyMinutes(5).create();
}
