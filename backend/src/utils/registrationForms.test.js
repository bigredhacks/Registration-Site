const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAnswersSchema,
  projectRegistrationColumns,
} = require('./registrationForms');

test('buildAnswersSchema requires every row in a required preference grid', () => {
  const fields = [
    {
      id: 'preferred_role',
      label: 'Preferred Role',
      type: 'preferenceGrid',
      required: true,
      rows: ['Frontend', 'Backend'],
      columns: ['1', '2', '3'],
    },
  ];

  const schema = buildAnswersSchema(fields);
  const result = schema.safeParse({
    preferred_role: {
      Frontend: '1',
    },
  });

  assert.equal(result.success, false);
  if (result.success) return;
  assert.match(result.error.issues[0]?.message ?? '', /Backend/);
});

test('buildAnswersSchema accepts complete answers for supported field types', () => {
  const fields = [
    {
      id: 'first_name',
      label: 'First Name',
      type: 'text',
      required: true,
    },
    {
      id: 'mlh_code_of_conduct',
      label: 'MLH Code of Conduct',
      type: 'checkbox',
      required: true,
    },
    {
      id: 'preferred_role',
      label: 'Preferred Role',
      type: 'preferenceGrid',
      required: true,
      rows: ['Frontend', 'Backend'],
      columns: ['1', '2', '3'],
    },
  ];

  const schema = buildAnswersSchema(fields);
  const result = schema.safeParse({
    first_name: 'Richie',
    mlh_code_of_conduct: true,
    preferred_role: {
      Frontend: '1',
      Backend: '2',
    },
  });

  assert.equal(result.success, true);
});

test('projectRegistrationColumns derives the admin summary fields from answers', () => {
  const projected = projectRegistrationColumns(
    {
      first_name: 'Richie',
      last_name: 'Xue',
      school: 'Cornell University',
      level_of_study: 'Senior',
      shirt_size: 'M',
      email: 'ignored@example.com',
    },
    {
      email: 'actual@cornell.edu',
    },
  );

  assert.deepEqual(projected, {
    first_name: 'Richie',
    last_name: 'Xue',
    school: 'Cornell University',
    level_of_study: 'Senior',
    shirt_size: 'M',
    email: 'actual@cornell.edu',
  });
});
