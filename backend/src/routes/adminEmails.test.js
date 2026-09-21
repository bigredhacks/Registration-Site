const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
process.env.SUPABASE_URL = 'https://admin-email-test.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-only-key';
process.env.RESEND_API_KEY = 'test-only-key';
require('ts-node').register({ project: path.resolve(__dirname, '../../tsconfig.json'), transpileOnly: true });
const emails = require('./adminEmails.ts').default;
const teams = require('./adminTeams.ts').default;
const releases = require('./adminReleaseEmails.ts').default;
const announcements = require('./adminAnnouncements.ts').default;
const { defaultTemplateHtml } = require('../utils/emailTemplates.ts');
const { supabase } = require('../config/supabase.ts');
const id = '00000000-0000-4000-8000-000000000001';
let records, writes, reads, rpc, savedDraft, uploads, storedRevision, uploadError, downloadError;
const invitationSettings = { deadline: new Date(Date.now()+86400000).toISOString(), time_zone: 'America/New_York', version: 2 };
const row = (n, overrides) => ({ id: n, form_key: 'registration', status: 'approved', first_name: 'Alex', last_name: 'Test', email: `alex${n}@example.com`, released_status: 'approved', decision_released_at: '2026-09-15T00:00:00Z', ...overrides });
test.beforeEach(() => {
  records = [row(1), row(2, { released_status: null }), row(3, { released_status: 'rejected' }), row(4, { email: '' }), row(5, { form_key: 'workshop' })];
  writes = []; reads = []; rpc = []; savedDraft = null; uploads = []; storedRevision = null; uploadError = false; downloadError = false;
  supabase.storage.from = bucket => ({
    async upload(path, content, options) { uploads.push({ bucket, path, content, options }); return { error: uploadError ? new Error('Offline') : null }; },
    async download(path) { return { data: downloadError ? null : new Blob([path.endsWith('.html') ? defaultTemplateHtml('approved').replace('BigRed//Hacks</p>', 'Stored layout</p>') : JSON.stringify({ subject: 'From Storage', body: 'Saved message', button_label: 'Respond' })]), error: downloadError ? new Error('Offline') : null }; },
  });
  process.env.EMAIL_DELIVERY_ENABLED = 'true';
  supabase.from = table => {
    const filters = []; reads.push(table);
    let payload;
    const result = () => ({ data: table === 'registrations' ? records.filter(row => filters.every(fn => fn(row))) : (table === 'email_batches' || table === 'email_decision_releases') ? savedDraft : table === 'email_template_files' ? storedRevision : table === 'invitation_settings' ? invitationSettings : [], error: null, count: table === 'registrations' ? records.filter(row => filters.every(fn => fn(row))).length : 0 });
    const builder = {
      abortSignal() { return builder; }, select() { return builder; }, order() { return builder; }, range() { return builder; }, ilike() { return builder; },
      eq(key, value) { filters.push(row => row[key] === value); return builder; },
      is(key, value) { filters.push(row => (row[key] ?? null) === value); return builder; },
      not(key, operator, value) { assert.equal(operator, 'is'); filters.push(row => (row[key] ?? null) !== value); return builder; },
      in(key, values) { filters.push(row => values.includes(row[key])); return builder; },
      insert(value) { payload = value; writes.push({ table, value }); savedDraft = { id, ...value }; return builder; },
      upsert(value, options) { writes.push({ table, value, options }); return builder; },
      async single() { return table === 'invitation_settings' ? result() : { data: { id, ...payload }, error: null }; },
      async maybeSingle() { return result(); },
      then(resolve) { return Promise.resolve(result()).then(resolve); },
    };
    return builder;
  };
  supabase.rpc = (name, args) => { rpc.push({ name, args }); return Object.assign(Promise.resolve({ data: { queued: 1, skipped: 0, version: 3 }, error: null }), { abortSignal() { return this; } }); };
});
async function request(router, method, route, body = {}, options = {}) {
  const layer = router.stack.find(entry => entry.route?.path === route && entry.route.methods[method]);
  assert.ok(layer);
  const req = { body, query: {}, params: { id }, user: { id: 'admin-id', email: 'admin@example.com' }, ...options };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
  for (const entry of layer.route.stack) { let next = false; await entry.handle(req, res, () => { next = true; }); if (!next) break; }
  return res;
}
test('preview selects only matching released main applications, with exact personalized snapshots', async () => {
  const response = await request(emails, 'post', '/drafts', { kind: 'approved', ids: [1, 1, 2, 3, 4, 5, 999] });
  assert.equal(response.statusCode, 201); assert.equal(response.body.recipients.length, 1); assert.equal(response.body.skipped.length, 5);
  assert.equal(writes[0].value.created_by, 'admin-id'); assert.equal(writes[0].value.messages[0].payload.to, 'alex1@example.com');
  assert.equal(writes[0].table, 'email_batches'); assert.equal(rpc.length, 0, 'preview does not queue');
  const preview = await request(emails, 'get', '/drafts/:id/preview', {}, { query: { registration_id: '1' } });
  assert.deepEqual(preview.body, response.body.preview);
});
test('bad cohorts and invalid query input fail before writes', async () => {
  for (const body of [{ kind: 'pending', ids: [1] }, { kind: 'approved', ids: [] }, { kind: 'approved', ids: [1], recipient: 'someone@example.com' }, { kind: 'approved', ids: Array(1001).fill(1) }]) assert.equal((await request(emails, 'post', '/drafts', body)).statusCode, 400);
  assert.equal(reads.length, 0);
  assert.equal((await request(emails, 'get', '/jobs', {}, { query: { offset: '-1' } })).statusCode, 400);
  assert.equal((await request(emails, 'get', '/jobs', {}, { query: { state: 'anything' } })).statusCode, 400);
  assert.equal((await request(emails, 'post', '/drafts', { kind: 'approved', ids: [2] })).statusCode, 400);
  assert.equal(writes.length, 0);
});
test('send respects delivery switch and uses the authenticated admin; tests go only to the admin inbox', async () => {
  delete process.env.EMAIL_DELIVERY_ENABLED;
  assert.equal((await request(emails, 'post', '/drafts/:id/send')).statusCode, 503); assert.equal(rpc.length, 0);
  process.env.EMAIL_DELIVERY_ENABLED = 'true';
  assert.equal((await request(emails, 'post', '/drafts/:id/send', { p_admin_id: 'forged' })).statusCode, 202);
  assert.deepEqual(rpc[0], { name: 'queue_decision_email_batch', args: { p_batch_id: id, p_admin_id: 'admin-id' } });
  await request(emails, 'post', '/drafts', { kind: 'approved', ids: [1] });
  assert.equal((await request(emails, 'post', '/drafts/:id/test', { to: 'unreviewed@example.com' })).statusCode, 202);
  const job = writes[1]; assert.equal(job.value.recipient, 'admin@example.com'); assert.equal(job.value.request_payload.to, 'admin@example.com');
  assert.equal(job.options.ignoreDuplicates, true);
});
test('team delete requires a reviewed name and membership snapshot and uses the authenticated admin', async () => {
  assert.equal((await request(teams, 'delete', '/admin/:id')).statusCode, 400);
  assert.equal((await request(teams, 'delete', '/admin/:id', { expected_name: 'Tide', expected_members: ['invalid'] })).statusCode, 400);
  assert.equal(rpc.length, 0);
  assert.equal((await request(teams, 'delete', '/admin/:id', { expected_name: 'Tide', expected_members: [id] })).statusCode, 200);
  assert.deepEqual(rpc[0], { name: 'admin_delete_user_team', args: { p_team_id: id, p_expected_name: 'Tide', p_expected_members: [id], p_admin_id: 'admin-id' } });
});

test('released cohorts are selected in Supabase without requiring a manual applicant list', async () => {
  const response = await request(emails, 'post', '/drafts', { kind: 'approved', scope: 'released' });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.recipients.map(row => row.id), [1]);
  assert.equal(writes[0].value.invitation_settings_version, 2);
  assert.match(writes[0].value.messages[0].payload.text, /Please accept by/);
  assert.equal((await request(emails, 'post', '/drafts', { kind: 'approved', scope: 'released', ids: [1] })).statusCode, 400);
});
test('email edits validate content and send the reviewed version and authenticated admin to the database', async () => {
  const response = await request(emails, 'put', '/templates/:kind', { subject: 'Invitation', body: 'Welcome!', button_label: 'Respond', html: defaultTemplateHtml('approved'), expected_version: 2 }, { params: { kind: 'approved' } });
  assert.equal(response.statusCode, 200);
  assert.equal(rpc[0].name, 'activate_email_template_files');
  assert.equal(rpc[0].args.p_expected_version, 2); assert.equal(rpc[0].args.p_admin_id, 'admin-id');
  assert.equal(uploads.length, 2); assert.equal(uploads[0].bucket, 'email-templates');
  assert.equal(uploads[0].path, rpc[0].args.p_storage_path + '/template.html');
  assert.equal(uploads[0].options.upsert, false); assert.match(uploads[0].content, /<!doctype html>/);
  assert.equal(JSON.parse(uploads[1].content).subject, 'Invitation');
  for (const body of [{ subject: '', body: 'Hi', button_label: '', expected_version: 0 }, { subject: 'Hi\nBcc: bad@example.com', body: 'Hi', button_label: '', expected_version: 0 }]) {
    assert.equal((await request(emails, 'put', '/templates/:kind', body, { params: { kind: 'approved' } })).statusCode, 400);
  }
});

test('sending uses downloaded HTML and fails closed on missing Storage files', async () => {
  storedRevision = { storage_path: 'approved/test-revision', version: 3 };
  const response = await request(emails, 'post', '/drafts', { kind: 'approved', ids: [1] });
  assert.equal(response.statusCode, 201); assert.equal(response.body.preview.subject, 'From Storage');
  assert.match(response.body.preview.html, /Stored layout/); assert.match(response.body.preview.html, /Saved message/);
  assert.match(response.body.preview.text, /Stored layout/, 'plain text follows the saved HTML');
  assert.doesNotMatch(response.body.preview.html, /BRH_FIRST_NAME|BRH_MESSAGE|BRH_SUBJECT|\{\{deadline_sentence\}\}/);
  downloadError = true;
  assert.equal((await request(emails, 'post', '/drafts', { kind: 'approved', ids: [1] })).statusCode, 500);
  assert.equal(writes.length, 1, 'failed download does not fall back to a different email');
});
test('failed uploads never activate incomplete files; approval HTML requires deadline and dashboard placeholders', async () => {
  const body = { subject: 'Hi', body: 'Hello', button_label: 'Respond', html: defaultTemplateHtml('approved'), expected_version: 0 };
  uploadError = true;
  assert.equal((await request(emails, 'put', '/templates/:kind', body, { params: { kind: 'approved' } })).statusCode, 500);
  assert.equal(rpc.length, 0);
  assert.equal((await request(emails, 'put', '/templates/:kind', { ...body, html: '<p>No deadline</p>' }, { params: { kind: 'approved' } })).statusCode, 400);
});

test('release previews use draft decisions and pair selected groups with one template load per kind', async () => {
  records=[row(1),row(2,{status:'rejected'}),row(3,{status:'waitlisted'}),row(4)];
  const decisions=records.map(row=>({id:row.id,expected_status:row.status}));
  const response=await request(releases,'post','/',{decisions,email_kinds:['approved','waitlisted']});
  assert.equal(response.statusCode,201);
  assert.deepEqual(response.body.recipients.map(r=>[r.id,r.kind]),[[1,'approved'],[3,'waitlisted'],[4,'approved']]);
  assert.equal(reads.filter(table=>table==='email_template_files').length,2);
  assert.equal(writes[0].table,'email_decision_releases');
  assert.equal(writes[0].value.messages[1].payload.to,'alex3@example.com');
  assert.match(writes[0].value.messages[1].payload.text,/waitlist/);
  assert.doesNotMatch(writes[0].value.messages[1].payload.text,/Please accept by|accept or decline/);
  assert.equal(rpc.length,0,'review does not release or send');
  const preview=await request(releases,'get','/:id/preview',{}, {query:{registration_id:'3'}});
  assert.equal(preview.body.to,'alex3@example.com');
});
test('dashboard-only release previews work without Resend or template files',async()=>{
  delete process.env.EMAIL_DELIVERY_ENABLED; downloadError=true; storedRevision={storage_path:'bad',version:1};
  const response=await request(releases,'post','/',{decisions:[{id:1,expected_status:'approved'}],email_kinds:[]});
  assert.equal(response.statusCode,201); assert.equal(response.body.enabled,false);
  assert.deepEqual(response.body.recipients,[]); assert.equal(reads.includes('email_template_files'),false);
  const confirm=await request(releases,'post','/:id/confirm');
  assert.equal(confirm.statusCode,200);
  assert.deepEqual(rpc[0],{name:'release_decisions_with_emails',args:{p_release_id:id,p_admin_id:'admin-id',p_delivery_enabled:false}});
});
test('release previews reject stale decisions, invalid recipients and untrusted content',async()=>{
  for(const body of [
    {decisions:[{id:1,expected_status:'approved'}],email_kinds:['approved'],payload:'forged'},
    {decisions:[{id:1,expected_status:'pending'}],email_kinds:[]},
    {decisions:[{id:1,expected_status:'approved'},{id:1,expected_status:'approved'}],email_kinds:[]},
  ]) assert.equal((await request(releases,'post','/',body)).statusCode,400);
  assert.equal((await request(releases,'post','/',{decisions:[{id:1,expected_status:'rejected'}],email_kinds:[]})).statusCode,409);
  assert.equal((await request(releases,'post','/',{decisions:[{id:4,expected_status:'approved'}],email_kinds:['approved']})).statusCode,409);
  assert.equal(writes.length,0);
});
test('release test emails use saved messages and only the signed-in admin address',async()=>{
  await request(releases,'post','/',{decisions:[{id:1,expected_status:'approved'}],email_kinds:['approved']});
  assert.equal((await request(releases,'post','/:id/test',{kind:'approved',to:'someone@example.com'})).statusCode,400);
  assert.equal((await request(releases,'post','/:id/test',{kind:'approved'})).statusCode,202);
  assert.equal(writes[1].value.request_payload.to,'admin@example.com');
  assert.equal(writes[1].options.ignoreDuplicates,true);
  assert.equal((await request(releases,'post','/:id/test',{kind:'waitlisted'})).statusCode,404);
  delete process.env.EMAIL_DELIVERY_ENABLED;
  assert.equal((await request(releases,'post','/:id/test',{kind:'approved'})).statusCode,503);
});

test('template tests support all email kinds and queue only the entered recipient without changing applicants',async()=>{
  const original=structuredClone(records);
  for(const kind of ['confirmation','approved','rejected','waitlisted','announcement']) {
    const response=await request(emails,'post','/test',{kind,to:' tester@example.com ',request_id:id});
    assert.equal(response.statusCode,202);
    const job=writes.at(-1);
    assert.equal(job.table,'email_outbox'); assert.equal(job.value.kind,'test');
    assert.equal(job.value.recipient,'tester@example.com'); assert.equal(job.value.request_payload.to,'tester@example.com');
    assert.equal(job.value.created_by,'admin-id'); assert.match(job.value.request_payload.subject,/^\[TEST\] /);
    assert.match(job.value.request_payload.html,/Hi Alex,/); assert.equal(job.value.registration_id,undefined);
  }
  assert.deepEqual(records,original); assert.equal(rpc.length,0);
});
test('template tests validate one recipient and reject paused delivery before loading templates or writing jobs',async()=>{
  for(const patch of [{to:'bad'}, {to:'one@example.com,two@example.com'}, {to:'good@example.com\nBcc: other@example.com'}, {kind:'pending'}, {request_id:'bad'}, {html:'untrusted'}]) {
    assert.equal((await request(emails,'post','/test',{kind:'approved',to:'tester@example.com',request_id:id,...patch})).statusCode,400);
  }
  delete process.env.EMAIL_DELIVERY_ENABLED;
  assert.equal((await request(emails,'post','/test',{kind:'approved',to:'tester@example.com',request_id:id})).statusCode,503);
  assert.equal(reads.length,0); assert.equal(writes.length,0);
});
test('retrying a template test preserves the queue key and payload; missing saved files cannot queue a fallback',async()=>{
  const body={kind:'approved',to:'tester@example.com',request_id:id};
  await request(emails,'post','/test',body);
  const first=structuredClone(writes[0]);
  await request(emails,'post','/test',body);
  assert.equal(writes[1].value.dedupe_key,first.value.dedupe_key);
  assert.deepEqual(writes[1].options,{onConflict:'dedupe_key',ignoreDuplicates:true});
  assert.deepEqual(writes[1].value.request_payload,first.value.request_payload);
  storedRevision={storage_path:'approved/missing',version:2}; downloadError=true;
  assert.equal((await request(emails,'post','/test',body)).statusCode,500);
  assert.equal(writes.length,2);
});

test('template tests personalize sample names and form titles without changing application records',async()=>{
  const original=structuredClone(records);
  const response=await request(emails,'post','/test',{kind:'confirmation',to:'tester@example.com',request_id:id,
    first_name:'  Jamie <Test> ',form_title:'Sample & Event',expected_version:0});
  assert.equal(response.statusCode,202);
  const payload=writes[0].value.request_payload;
  assert.match(payload.html,/Hi Jamie &lt;Test&gt;,/);
  assert.match(payload.html,/Sample &amp; Event/);
  assert.match(payload.text,/Jamie <Test>/);
  assert.deepEqual(records,original);
});
test('test personalization rejects blank or oversized values and stale template versions',async()=>{
  for (const patch of [{first_name:''},{first_name:' '.repeat(4)},{first_name:'x'.repeat(101)}, {form_title:'x'.repeat(201)}, {form_title:'Event\nInjected'}]) {
    assert.equal((await request(emails,'post','/test',{kind:'confirmation',to:'tester@example.com',request_id:id,...patch})).statusCode,400);
  }
  assert.equal((await request(emails,'post','/test',{kind:'confirmation',to:'tester@example.com',request_id:id,expected_version:3})).statusCode,409);
  assert.equal(writes.length,0);
});

test('announcements filter main applications by admin acceptance status, freeze saved content, and skip invalid/duplicate addresses', async () => {
  records = [row(1, { status: 'pending', released_status: null }), row(2), row(3, { status: 'pending', email: ' ALEX1@example.com ' }), row(4, { status: 'pending', email: 'bad' }), row(5, { status: 'pending', form_key: 'workshop' })];
  const response = await request(announcements, 'post', '/drafts', { audience: { type: 'acceptance', status: 'pending' }, expected_version: 0 });
  assert.equal(response.statusCode, 201);
  assert.deepEqual(response.body.recipients.map(row => row.id), [1]);
  assert.deepEqual(response.body.skipped.map(row => row.id), [3, 4]);
  assert.equal(writes[0].value.kind, 'announcement');
  assert.deepEqual(writes[0].value.audience, { type: 'acceptance', status: 'pending' });
  assert.equal(writes[0].value.messages[0].payload.to, 'alex1@example.com');
  assert.match(response.body.preview.html, /Hi Alex,/);
  assert.doesNotMatch(response.body.preview.html, /Respond to invitation|Please accept by|href="[^"]*\/dashboard"/);
  assert.deepEqual(rpc.map(call => call.name), ['expire_registration_invitations'], 'preparing does not queue messages');
});
test('announcement invitation groups distinguish actual responses, unanswered released approvals, and expirations', async () => {
  records = [row(1, { invitation_response: 'accepted' }), row(2, { invitation_response: 'declined' }), row(3),
    row(4, { invitation_response: 'declined', invitation_expired_at: '2026-09-15T00:00:00Z', released_status: 'rejected' }),
    row(5, { released_status: null }), row(6, { released_status: 'rejected', invitation_response: 'accepted' })];
  for (const [status, id] of [['accepted', 1], ['declined', 2], ['unanswered', 3], ['expired', 4]]) {
    const response = await request(announcements, 'post', '/drafts', { audience: { type: 'invitation', status }, expected_version: 0 });
    assert.equal(response.statusCode, 201);
    assert.deepEqual(response.body.recipients.map(row => row.id), [id]);
  }
});
test('announcement requests reject forged content, bad cohorts, stale templates, empty groups and oversized groups', async () => {
  for (const body of [
    { audience: { type: 'invitation', status: 'pending' }, expected_version: 0 },
    { audience: { type: 'all' }, expected_version: 0, html: 'forged' },
    { audience: { type: 'all', status: 'accepted' }, expected_version: 0 },
    { audience: { type: 'all' } },
  ]) assert.equal((await request(announcements, 'post', '/drafts', body)).statusCode, 400);
  assert.equal(reads.length, 0);
  assert.equal((await request(announcements, 'post', '/drafts', { audience: { type: 'all' }, expected_version: 4 })).statusCode, 409);
  records = [];
  assert.equal((await request(announcements, 'post', '/drafts', { audience: { type: 'all' }, expected_version: 0 })).statusCode, 400);
  records = Array.from({ length: 1001 }, (_, i) => row(i + 1));
  assert.equal((await request(announcements, 'post', '/drafts', { audience: { type: 'all' }, expected_version: 0 })).statusCode, 400);
  assert.equal(writes.length, 0);
});
test('announcement send requires enabled delivery and queues only the saved batch for the signed-in admin', async () => {
  delete process.env.EMAIL_DELIVERY_ENABLED;
  assert.equal((await request(announcements, 'post', '/drafts/:id/send')).statusCode, 503);
  assert.equal(rpc.length, 0);
  process.env.EMAIL_DELIVERY_ENABLED = 'true';
  assert.equal((await request(announcements, 'post', '/drafts/:id/send', { p_admin_id: 'forged' })).statusCode, 202);
  assert.deepEqual(rpc[0], { name: 'queue_announcement_email_batch', args: { p_batch_id: id, p_admin_id: 'admin-id' } });
});
test('general announcement templates can be edited through the existing revisioned storage API', async () => {
  const response = await request(emails, 'put', '/templates/:kind', {
    subject: 'Event update', body: 'Doors open at six.', button_label: '', html: defaultTemplateHtml('announcement'), expected_version: 0,
  }, { params: { kind: 'announcement' } });
  assert.equal(response.statusCode, 200);
  assert.equal(rpc[0].args.p_kind, 'announcement');
  assert.match(uploads[0].path, /^announcement\//);
  assert.equal(JSON.parse(uploads[1].content).body, 'Doors open at six.');
});

function mockAnnouncementDeadlineTemplate() {
  storedRevision = { storage_path: 'announcement/deadline-test', version: 3 };
  supabase.storage.from = () => ({ async download(file) {
    return { data: new Blob([file.endsWith('.html')
      ? defaultTemplateHtml('announcement').replace('{{message_html}}', '<p>Deadline: {{deadline}}</p>{{message_html}}')
      : JSON.stringify({ subject: 'Reply by {{deadline}}', body: 'Please respond by {{deadline}}.', button_label: '' })]), error: null };
  } });
}

test('announcement editor, test email and frozen batch use the configured deadline and time zone', async t => {
  const originalSettings = { ...invitationSettings };
  t.after(() => Object.assign(invitationSettings, originalSettings));
  Object.assign(invitationSettings, { deadline: '2030-07-15T18:00:00.000Z', time_zone: 'America/Los_Angeles' });
  mockAnnouncementDeadlineTemplate();
  const editor = await request(emails, 'get', '/templates/:kind', {}, { params: { kind: 'announcement' } });
  assert.equal(editor.statusCode, 200);
  const testEmail = await request(emails, 'post', '/test', { kind: 'announcement', to: 'tester@example.com', request_id: id, expected_version: 3 });
  assert.equal(testEmail.statusCode, 202);
  const testPayload = writes.at(-1).value.request_payload;
  const draft = await request(announcements, 'post', '/drafts', { audience: { type: 'all' }, expected_version: 3 });
  assert.equal(draft.statusCode, 201);
  for (const key of ['subject', 'html', 'text']) {
    assert.equal(draft.body.preview[key], editor.body[key]);
    assert.equal(testPayload[key], (key === 'subject' ? '[TEST] ' : '') + editor.body[key]);
    assert.match(draft.body.preview[key], /11:00 AM PDT/);
    assert.doesNotMatch(draft.body.preview[key], /Deadline not set|\{\{deadline\}\}/);
  }
  const frozen = structuredClone(draft.body.preview);
  Object.assign(invitationSettings, { deadline: '2030-07-16T18:00:00.000Z', time_zone: 'America/New_York' });
  const saved = await request(emails, 'get', '/drafts/:id/preview', {}, { query: { registration_id: '1' } });
  assert.deepEqual(saved.body, frozen, 'later deadline edits do not change a reviewed batch');
});

test('announcements show an unset deadline consistently without sending a sample date', async t => {
  const originalSettings = { ...invitationSettings };
  t.after(() => Object.assign(invitationSettings, originalSettings));
  invitationSettings.deadline = null;
  mockAnnouncementDeadlineTemplate();
  const editor = await request(emails, 'get', '/templates/:kind', {}, { params: { kind: 'announcement' } });
  assert.equal(editor.statusCode, 200);
  assert.equal(editor.body.deadline, null);
  assert.equal(editor.body.sample_deadline, false);
  const testEmail = await request(emails, 'post', '/test', { kind: 'announcement', to: 'tester@example.com', request_id: id });
  assert.equal(testEmail.statusCode, 202);
  const testPayload = writes.at(-1).value.request_payload;
  const draft = await request(announcements, 'post', '/drafts', { audience: { type: 'all' }, expected_version: 3 });
  assert.equal(draft.statusCode, 201);
  for (const key of ['subject', 'html', 'text']) {
    assert.match(draft.body.preview[key], /Deadline not set/);
    assert.equal(draft.body.preview[key], editor.body[key]);
    assert.equal(testPayload[key], (key === 'subject' ? '[TEST] ' : '') + editor.body[key]);
  }
  storedRevision = null;
  const approval = await request(emails, 'get', '/templates/:kind', {}, { params: { kind: 'approved' } });
  assert.equal(approval.statusCode, 200);
  assert.equal(approval.body.sample_deadline, true, 'approval previews still support the existing sample date');
});
