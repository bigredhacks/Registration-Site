const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.SUPABASE_URL = 'https://email-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
process.env.RESEND_API_KEY = 'test-only-key';
process.env.EMAIL_SITE_URL = 'https://example.com';
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const { processEmailJob, drainEmailQueue, queueStore } = require('./emailQueue.ts');
const { emailPayload, renderEmail, sendEmail, EmailSendError } = require('./email.ts');
const job = overrides => ({ id: 'job-1', kind: 'confirmation', recipient: 'alex@example.com', first_name: 'Alex', form_title: 'BigRed//Hacks', request_payload: null, attempts: 1, lease_token: 'lease-1', ...overrides });
const frozen = emailPayload('approved', 'alex@example.com', 'Alex');

test('confirmation persists the full payload before sending; send receipt is stored afterward', async () => {
  const actions = [];
  const store = { async save(_job, changes) { actions.push(changes); } };
  await processEmailJob(job(), store, async (payload, key) => { assert.deepEqual(actions[0].request_payload, payload); assert.match(actions[0].template_version, /2026-09-15-v3/); assert.equal(key, 'brh-email/job-1'); return 'resend-1'; }, () => 1000);
  assert.equal(actions[1].state, 'sent'); assert.equal(actions[1].resend_id, 'resend-1'); assert.equal(actions[1].lease_token, null);
});
test('failed payload persistence sends nothing; interrupted success write retries identical content and key', async () => {
  let sends = 0;
  await assert.rejects(processEmailJob(job(), { async save() { throw new Error('database unavailable'); } }, async () => { sends++; }), /database unavailable/);
  assert.equal(sends, 0);
  const deliveries = [];
  const send = async (payload, key) => { deliveries.push({ payload, key }); return 'resend-1'; };
  await assert.rejects(processEmailJob(job({ request_payload: frozen }), { async save() { throw new Error('receipt save failed'); } }, send), /receipt save failed/);
  process.env.RESEND_FROM_ADDRESS = 'New sender <new@example.com>';
  await processEmailJob(job({ request_payload: frozen, attempts: 2, lease_token: 'lease-2' }), { async save() {} }, send);
  assert.deepEqual(deliveries[0], deliveries[1]);
  delete process.env.RESEND_FROM_ADDRESS;
});
test('temporary failures back off; permanent and exhausted failures stop for review', async () => {
  for (const [error, attempts, expected] of [[new Error('timeout'), 1, 'queued'], [new EmailSendError('HTTP 429', true), 2, 'queued'], [new EmailSendError('HTTP 422', false), 1, 'failed'], [new Error('timeout'), 6, 'failed']]) {
    const changes = [];
    await processEmailJob(job({ request_payload: frozen, attempts }), { async save(_job, values) { changes.push(values); } }, async () => { throw error; }, () => 1000);
    assert.equal(changes[0].state, expected); assert.equal(changes[0].lease_token, null);
    assert.ok(Date.parse(changes[0].available_at) > 1000);
  }
});
test('missing snapshots and invalid recipients fail without calling Resend; disabled worker never claims', async () => {
  for (const data of [job({ kind: 'approved' }), job({ recipient: 'invalid' })]) {
    const changes = [];
    await processEmailJob(data, { async save(_job, values) { changes.push(values); } }, async () => { assert.fail('must not send'); });
    assert.equal(changes[0].state, 'failed');
  }
  delete process.env.EMAIL_DELIVERY_ENABLED;
  const original = queueStore.claim;
  queueStore.claim = async () => { assert.fail('disabled worker must not claim'); };
  try { let expirations = 0; assert.deepEqual(await drainEmailQueue(async () => { expirations++; return 4; }), { processed: 0, paused: true, expired: 4 }); assert.equal(expirations, 1); } finally { queueStore.claim = original; }
});
test('templates escape user input, have inline styling and plain text, and only invitations offer RSVP', () => {
  const approved = renderEmail('approved', '<script>Alex</script>');
  assert.ok(approved.html.includes('&lt;script&gt;Alex&lt;/script&gt;'));
  assert.ok(!approved.html.includes('<script>'));
  assert.match(approved.html, /style="/); assert.match(approved.html, /https:\/\/example.com\/dashboard/);
  assert.match(approved.text, /accept or decline/);
  const denied = renderEmail('rejected', 'Alex');
  assert.match(denied.text, /apply again next year/); assert.doesNotMatch(denied.html, /href="https:\/\/example.com\/dashboard/); assert.match(denied.html, /href="mailto:bigredhacks@cornell.edu"/);
  const confirmation = renderEmail('confirmation', 'Alex', '<Custom form>');
  assert.match(confirmation.html, /&lt;Custom form&gt;/); assert.match(confirmation.text, /<Custom form>/);
});
test('Resend adapter sends HTML and text with a stable key and classifies provider errors', async () => {
  const original = global.fetch;
  try {
    global.fetch = async (url, options) => {
      assert.equal(url, 'https://api.resend.com/emails');
      assert.equal(options.headers['Idempotency-Key'], 'same-key');
      assert.deepEqual(JSON.parse(options.body), frozen); assert.ok(options.signal);
      return new Response(JSON.stringify({ id: 'resend-123' }), { status: 200 });
    };
    assert.equal(await sendEmail(frozen, 'same-key'), 'resend-123');
    for (const [status, name, retryable] of [[429, 'rate_limit_exceeded', true], [500, 'internal_server_error', true], [409, 'concurrent_idempotent_requests', true], [409, 'invalid_idempotent_request', false], [422, 'validation_error', false]]) {
      global.fetch = async () => new Response(JSON.stringify({ name }), { status });
      await assert.rejects(sendEmail(frozen, 'same-key'), error => error instanceof EmailSendError && error.retryable === retryable);
    }
  } finally { global.fetch = original; }
});

test('saved template text is used for confirmations and the required approval deadline remains in every edited email', async () => {
  const template = { subject: 'A custom subject', body: 'Your application to {{form_title}} is here.', button_label: 'Open dashboard', version: 4 };
  let persisted;
  await processEmailJob(job(), { confirmationTemplate: async () => template, async save(_job, changes) { if(changes.request_payload) persisted = changes.request_payload; } }, async payload => { assert.equal(payload.subject, template.subject); return 'id'; });
  assert.match(persisted.text, /Your application to BigRed\/\/Hacks is here/);
  const rendered = renderEmail('approved', 'Alex', undefined, { ...template, body: '<b>New copy</b>' }, '2026-09-21T04:00:00.000Z', 'America/New_York');
  assert.match(rendered.html, /&lt;b&gt;New copy&lt;\/b&gt;/);
  assert.match(rendered.text, /midnight Sunday \(9\/20\)/);
  assert.match(rendered.text, /Eastern time/);
  assert.doesNotMatch(rendered.html, /Georgia|monospace/);
});

test('confirmation template failures back off per job and do not block frozen decision emails', async () => {
  const previous=process.env.EMAIL_DELIVERY_ENABLED;
  process.env.EMAIL_DELIVERY_ENABLED='true';
  try {
    let downloads=0;
    const changes=[], sent=[];
    const jobs=[job({id:'broken-1'}),job({id:'broken-2',attempts:6}),job({id:'decision',kind:'approved',request_payload:frozen})];
    const result=await drainEmailQueue(async()=>0, {
      store:{
        async claim(){return jobs.shift() ?? null;},
        async confirmationTemplate(){downloads++; throw new Error('Missing Storage file');},
        async save(job,change){changes.push({id:job.id,...change});},
      },
      async send(payload,key){sent.push(key); assert.deepEqual(payload,frozen); return 'resend-decision';},
      now:()=>1000, pause:async()=>{},
    });
    assert.equal(result.processed,3); assert.equal(downloads,1,'cache failed lookups within the pass');
    assert.deepEqual(sent,['brh-email/decision']);
    assert.equal(changes[0].state,'queued'); assert.ok(Date.parse(changes[0].available_at)>1000);
    assert.equal(changes[0].lease_token,null); assert.equal(changes[1].state,'failed');
    assert.equal(changes[2].state,'sent');
  } finally { if(previous===undefined) delete process.env.EMAIL_DELIVERY_ENABLED; else process.env.EMAIL_DELIVERY_ENABLED=previous; }
});

test('confirmations share one template per worker pass, refresh next pass, and frozen retries skip Storage', async () => {
  const previous=process.env.EMAIL_DELIVERY_ENABLED;
  process.env.EMAIL_DELIVERY_ENABLED='true';
  try {
    let downloads=0;
    const deliveries=[];
    const run=async jobs=>drainEmailQueue(async()=>0, {
      store:{
        async claim(){return jobs.shift() ?? null;},
        async confirmationTemplate(){ downloads++; return {subject:`Revision ${downloads}`,body:'Hello',button_label:'Dashboard',version:downloads}; },
        async save(){},
      },
      async send(payload){deliveries.push(payload.subject); return 'id';},now:()=>1000,pause:async()=>{},
    });
    await run([job({id:'a'}),job({id:'b'})]);
    assert.equal(downloads,1); assert.deepEqual(deliveries,['Revision 1','Revision 1']);
    await run([job({id:'c'})]); assert.equal(downloads,2); assert.equal(deliveries[2],'Revision 2');
    await run([job({request_payload:frozen,attempts:2})]); assert.equal(downloads,2);
  } finally { if(previous===undefined) delete process.env.EMAIL_DELIVERY_ENABLED; else process.env.EMAIL_DELIVERY_ENABLED=previous; }
});
