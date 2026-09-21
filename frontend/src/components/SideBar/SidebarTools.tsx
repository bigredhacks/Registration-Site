import { useLocation } from 'react-router-dom';
import { useAdmin } from '@/lib/useAdmin';
import { useApplicantPreview } from '@/lib/ApplicantPreviewContext';
import SideButton from './SideButton';

const shield = <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z" /></svg>;

export default function SidebarTools() {
  const { isAdmin } = useAdmin();
  const preview = useApplicantPreview();
  const { pathname } = useLocation();
  const previewPath = ['/dashboard', '/profile', '/register', '/team'].includes(pathname) ? pathname : '/dashboard';
  if (!isAdmin && !import.meta.env.DEV) return null;

  return <div className="mt-5 border-t border-white/25 pt-4 lg:mt-auto lg:pt-5" aria-label="Organizer tools">
    {import.meta.env.DEV && (preview ? (
      <label className="mb-3 block font-poppins text-white">
        <span className="mb-2 block px-1 text-xs font-semibold">View as applicant</span>
        <select
          aria-label="View as applicant"
          value={preview.personaId}
          onChange={(event) => preview.selectPersona(event.target.value)}
          className="min-h-11 w-full min-w-0 rounded-lg border border-white/40 bg-red6 px-2 text-sm text-white focus:outline-2 focus:outline-offset-2 focus:outline-white"
        >
          {preview.personas.map(persona => <option key={persona.id} value={persona.id}>{persona.label}</option>)}
        </select>
      </label>
    ) : (
      <a href={`/applicant-preview.html#${previewPath}`} className="mb-2 flex min-h-12 items-center gap-2 rounded-lg px-2 font-poppins text-sm font-medium text-white hover:bg-red4 lg:gap-3 lg:px-4">
        <svg aria-hidden="true" className="shrink-0" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></svg>
        View as applicant
      </a>
    ))}
    {(isAdmin || (import.meta.env.DEV && preview)) && <SideButton to="/admin" iconElement={shield}>Admin</SideButton>}
  </div>;
}
