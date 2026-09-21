import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './config/supabase';
import Dashboard from './pages/registration/dashboard';
import Profile from './pages/registration/profile';
import TeamPage from './pages/TeamPage';
import ToastProvider from './components/Toast/ToastProvider';
import { ApplicantPreviewContext } from './lib/ApplicantPreviewContext';
import { COUNTRIES_CSV_URL, SCHOOLS_CSV_URL, hackathonRegistrationFormConfig } from './lib/formConfig';
import { APPLICANT_PERSONAS, createPreviewApplicant, handleApplicantPreviewRequest, resolvePersona } from './preview/applicantPreviewState';
import './index.css';

if (!import.meta.env.DEV || window.location.pathname !== '/applicant-preview.html') throw new Error('Applicant preview is development-only.');

let selected = resolvePersona(new URL(window.location.href).searchParams.get('persona'));
const applicants = new Map(APPLICANT_PERSONAS.map(persona => [persona.id, createPreviewApplicant(persona.id)]));
const currentApplicant = () => applicants.get(selected)!;
const currentUser = (): User => {
  const applicant = currentApplicant();
  return { id: applicant.userId, email: applicant.email, aud: 'authenticated', role: 'authenticated',
    app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z', email_confirmed_at: '2026-01-01T00:00:00Z' };
};
const originalFetch = window.fetch;
const originalGetUser = supabase.auth.getUser;
const originalGetSession = supabase.auth.getSession;
const originalResend = supabase.auth.resend;
supabase.auth.getUser = async () => ({ data: { user: currentUser() }, error: null });
supabase.auth.getSession = async () => ({ data: { session: {
  access_token: 'local-preview-only', refresh_token: 'local-preview-only', token_type: 'bearer', expires_in: 3600,
  user: currentUser(),
} satisfies Session }, error: null });
supabase.auth.resend = async () => ({ data: { user: null, session: null }, error: null });

// Every fetch is handled locally, including CSV options. Never fall through to
// the real API, Supabase, or email providers, even for unsupported actions.
window.fetch = async (input, init) => {
  const applicant = currentApplicant();
  const url = new URL(input instanceof Request ? input.url : String(input), window.location.origin);
  if (url.href === SCHOOLS_CSV_URL) return new Response('school\nCornell University\nColumbia University\nRochester Institute of Technology');
  if (url.href === COUNTRIES_CSV_URL) return new Response('name\nUnited States of America\nCanada\nIndia');
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'External requests are disabled in the applicant preview.' }), { status: 501 });
  }
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(typeof init?.body === 'string' ? init.body : input instanceof Request ? await input.clone().text() || '{}' : '{}'); }
  catch { return new Response(JSON.stringify({ error: 'Invalid request body.' }), { status: 400 }); }
  const response = handleApplicantPreviewRequest(applicant, (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase(),
    url.pathname, url.searchParams, body, hackathonRegistrationFormConfig.fields);
  return new Response(JSON.stringify(response.body), { status: response.status, headers: { 'Content-Type': 'application/json' } });
};

export function ApplicantPreview() {
  const [personaId, setPersonaId] = useState(selected);
  const [revision, setRevision] = useState(0);
  const persona = APPLICANT_PERSONAS.find(persona => persona.id === personaId)!;
  const selectPersona = (value: string) => {
    selected = resolvePersona(value);
    const url = new URL(window.location.href);
    url.searchParams.set('persona', selected);
    window.history.replaceState(window.history.state, '', url);
    setPersonaId(selected);
  };
  const reset = () => {
    applicants.set(personaId, createPreviewApplicant(personaId));
    setRevision(revision => revision + 1);
  };
  return <ApplicantPreviewContext.Provider value={{ view: 'applicant', personaId, name: persona.name, description: persona.description,
    personas: APPLICANT_PERSONAS, selectPersona, reset }}>
    <HashRouter>
      <ToastProvider key={`${personaId}-${revision}`}>
        <Routes>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/register" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </ToastProvider>
    </HashRouter>
  </ApplicantPreviewContext.Provider>;
}

const root = createRoot(document.getElementById('root')!);
root.render(<ApplicantPreview />);
if (import.meta.hot) import.meta.hot.dispose(() => {
  root.unmount(); window.fetch = originalFetch;
  supabase.auth.getUser = originalGetUser; supabase.auth.getSession = originalGetSession; supabase.auth.resend = originalResend;
});
