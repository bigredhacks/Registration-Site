-- Form configurations stored as JSONB so admins can edit fields without a code change.
-- One row per `key` (e.g. 'registration', 'team-matching').
create table if not exists public.form_configs (
  key text primary key,
  title text not null,
  description text,
  fields jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Seed the registration form with the existing hardcoded config.
insert into public.form_configs (key, title, description, fields)
values (
  'registration',
  'BigRed//Hacks Fall 2026 Registration',
  'Complete your registration for the hackathon',
  $json$
  [
    {"id":"first_name","label":"First Name","type":"text","required":true,"placeholder":"First Name"},
    {"id":"last_name","label":"Last Name","type":"text","required":true,"placeholder":"Last Name"},
    {"id":"age","label":"Age Range","type":"dropdown","required":true,"options":["Under 18","18–20","21–24","25–30","31+"]},
    {"id":"phone_number","label":"Phone Number","type":"text","required":true,"placeholder":"(123) 456-7890"},
    {"id":"email","label":"Email Address","type":"email","required":true,"placeholder":"bigredhacks@gmail.com"},
    {"id":"linkedin","label":"LinkedIn","type":"text","required":false,"placeholder":"https://www.linkedin.com/in/your-profile"},
    {"id":"school","label":"School","type":"dropdown","required":true,"searchable":true,"allowCustomValue":true,"options":[],"optionsSource":{"type":"csv","csvType":"schools","url":"https://raw.githubusercontent.com/MLH/mlh-policies/main/schools.csv"}},
    {"id":"country","label":"Country of Residence","type":"dropdown","required":true,"searchable":true,"options":[],"optionsSource":{"type":"csv","csvType":"countries","url":"https://raw.githubusercontent.com/MLH/mlh-policies/main/countries.csv"}},
    {"id":"level_of_study","label":"Level of Study","type":"dropdown","required":true,"options":["Secondary / High School","Freshman","Sophomore","Junior","Senior","I'm not currently a student"]},
    {"id":"major","label":"Major","type":"dropdown","required":false,"searchable":true,"allowCustomValue":true,"options":["Computer Science","Information Science","Electrical and Computer Engineering","Mechanical Engineering","Operations Research","Mathematics","Physics","Biology","Chemistry","Economics","Other"]},
    {"id":"gender","label":"Gender","type":"radio","required":true,"options":["Male","Female","Non-binary","Prefer not to say","Other"]},
    {"id":"dietary_restrictions","label":"Dietary Restrictions","type":"checkboxGroup","required":false,"options":["None","Vegetarian","Vegan","Gluten-Free","Halal","Kosher","Nut Allergy","Other"]},
    {"id":"shirt_size","label":"Shirt Size","type":"radio","required":true,"options":["XS","S","M","L","XL","2XL"]},
    {"id":"mlh_code_of_conduct","label":"MLH Code of Conduct","type":"checkbox","required":true,"checkboxText":"I have read and agree to the","linkText":"MLH Code of Conduct.","linkUrl":"https://github.com/MLH/mlh-policies/blob/main/code-of-conduct.md"},
    {"id":"mlh_data_sharing_consent","label":"MLH Data Sharing and Terms","type":"checkbox","required":true,"checkboxText":"I authorize you to share my application/registration information with Major League Hacking for event administration, ranking, and MLH administration in-line with the MLH Privacy Policy. I further agree to the terms of both the MLH Contest Terms and Conditions and the MLH Privacy Policy."},
    {"id":"mlh_emails_opt_in","label":"MLH Emails","type":"checkbox","required":false,"checkboxText":"I authorize MLH to send me occasional emails about relevant events, career opportunities, and community announcements."}
  ]
  $json$::jsonb
)
on conflict (key) do nothing;

alter table public.form_configs enable row level security;

-- Anyone authenticated can read active configs (registration form needs them).
drop policy if exists "form_configs_select_active" on public.form_configs;
create policy "form_configs_select_active"
  on public.form_configs for select
  using (auth.role() = 'authenticated' and is_active);
