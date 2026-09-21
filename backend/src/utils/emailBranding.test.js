const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
require('ts-node').register({project:path.resolve(__dirname,'../../tsconfig.json'),transpileOnly:true});
const { addEmailBranding, defaultTemplateHtml, DEFAULT_EMAIL_TEMPLATES, renderEmailTemplate } = require('./emailTemplates.ts');

test('all email templates render a public logo URL and contact link without unresolved placeholders',()=>{
  for(const kind of Object.keys(DEFAULT_EMAIL_TEMPLATES)) {
    const html=defaultTemplateHtml(kind);
    assert.match(html,/\{\{logo_url\}\}/);
    const rendered=renderEmailTemplate(kind,'Jamie',undefined,'https://portal.example.com',{...DEFAULT_EMAIL_TEMPLATES[kind],html});
    assert.match(rendered.html,/src="https:\/\/portal.example.com\/email-assets\/brh-logo-red.png"/);
    assert.match(rendered.html,/href="mailto:bigredhacks@cornell.edu"/);
    assert.match(rendered.text,/Contact us at bigredhacks@cornell.edu/);
    assert.doesNotMatch(rendered.html,/\{\{logo_url\}\}|brh-dashboard-placeholder/);
    assert.equal((rendered.html.match(/data-brh-branding/g)||[]).length,1);
  }
});
test('older Storage layouts gain branding once and preserve customized content',()=>{
  const legacy='<html><body><p style="color:red">BigRed//Hacks</p><p>Hi {{first_name}},</p><p>Our custom message stays here.</p><p style="margin:4px">The BigRed//Hacks team</p></body></html>';
  const updated=addEmailBranding(legacy);
  assert.match(updated,/Our custom message stays here/);
  assert.match(updated,/<p style="margin:4px">The BigRed\/\/Hacks team<\/p>/);
  assert.match(updated,/\{\{first_name\}\}/);
  assert.equal(addEmailBranding(updated),updated);
  assert.match(renderEmailTemplate('confirmation','Jamie',undefined,undefined,{...DEFAULT_EMAIL_TEMPLATES.confirmation,html:legacy}).html,/Hi Jamie,/);
});

test('announcements reuse the shared layout with editable escaped copy and no invitation extras', () => {
  const template = { ...DEFAULT_EMAIL_TEMPLATES.announcement, html: defaultTemplateHtml('announcement'), subject: 'Event update', body: 'Doors open at 6.\n\nBring <your laptop> & a charger.' };
  const rendered = renderEmailTemplate('announcement', 'Jamie <Test>', undefined, undefined, template);
  assert.equal(rendered.subject, 'Event update');
  assert.match(rendered.html, /Hi Jamie &lt;Test&gt;,/);
  assert.match(rendered.html, /Bring &lt;your laptop&gt; &amp; a charger/);
  assert.match(rendered.text, /Bring <your laptop> & a charger/);
  assert.match(rendered.html, /background:#FDECEA/);
  assert.doesNotMatch(rendered.html, /Please accept by|Already responded|href="[^"]*\/dashboard"|\{\{/);
});
