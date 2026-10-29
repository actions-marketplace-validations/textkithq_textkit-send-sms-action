// Send SMS with TextKit: a zero-dependency JavaScript action.
//
// Reads inputs from INPUT_* env vars (GitHub keeps hyphens: INPUT_API-KEY),
// POSTs /v1/messages, writes message-id and status to $GITHUB_OUTPUT, and
// fails the step on any non-2xx response with the API's own error message.
// No @actions/core so the repo needs no node_modules or build step.
const { appendFileSync } = require('node:fs');
const { randomUUID } = require('node:crypto');

const input = (name) => (process.env[`INPUT_${name.toUpperCase()}`] || '').trim();

// Workflow-command escaping, per GitHub's toolkit (%, CR, LF).
const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const fail = (msg) => {
  console.log(`::error title=TextKit::${esc(msg)}`);
  process.exitCode = 1;
};
const setOutput = (name, value) => {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) return console.log(`${name}=${value}`);
  const delim = `ghadelim_${randomUUID()}`;
  appendFileSync(file, `${name}<<${delim}\n${value}\n${delim}\n`);
};

async function main() {
  const apiKey = input('api-key');
  const to = input('to');
  const body = process.env['INPUT_BODY'] || '';
  const from = input('from');
  const baseUrl = (input('base-url') || 'https://api.jointextkit.com/v1').replace(/\/+$/, '');

  if (!apiKey) return fail('Missing api-key. Pass it from a secret: api-key: ${{ secrets.TEXTKIT_API_KEY }}');
  if (!to) return fail('Missing to. Use E.164 format, e.g. +15551234567.');
  if (!body.trim()) return fail('Missing body.');
  console.log(`::add-mask::${apiKey}`);

  const payload = { to, body };
  if (from) payload.from = from;

  let res;
  try {
    res = await fetch(`${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'textkit-send-sms-action/1.0.0',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    return fail(`Could not reach TextKit: ${err && err.message ? err.message : err}`);
  }

  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON body: reported below */
  }

  if (!res.ok) {
    const e = json && json.error;
    const msg = e && e.message ? e.message : text.slice(0, 500) || res.statusText;
    const code = e && e.code ? ` (${e.code})` : '';
    const reqId = e && e.request_id ? ` [${e.request_id}]` : '';
    return fail(`HTTP ${res.status}${code}: ${msg}${reqId}`);
  }

  const id = json && json.id ? json.id : '';
  const status = json && json.status ? json.status : '';
  setOutput('message-id', id);
  setOutput('status', status);
  console.log(`Sent ${id} to ${to}: ${status}${json && json.simulated ? ' (test key: simulated, no text sent)' : ''}`);
  if (status === 'blocked' || status === 'failed') {
    const f = json.failure;
    const why = f && (f.explanation || f.title);
    return fail(`Message ${id} was ${status}${why ? `: ${why}` : ''}`);
  }
}

main().catch((err) => fail(err && err.stack ? err.stack : String(err)));
