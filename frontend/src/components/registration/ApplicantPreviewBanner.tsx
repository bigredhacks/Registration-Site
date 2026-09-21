import { useApplicantPreview } from '@/lib/ApplicantPreviewContext';
import { useLocation } from 'react-router-dom';

export default function ApplicantPreviewBanner() {
  const preview = useApplicantPreview();
  const { pathname } = useLocation();
  if (!import.meta.env.DEV || !preview || preview.view !== 'applicant') return null;
  return <section aria-label="Local applicant preview" className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red5/20 bg-red7/60 px-4 py-3 font-poppins">
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-red6">Local applicant preview</p>
      <p className="mt-1 text-sm font-semibold text-gray-900">Viewing as {preview.name}</p>
      <p className="mt-1 text-xs leading-relaxed text-gray-600">{preview.description} Fictional data; changes stay in this tab.</p>
      {pathname === '/team' && <p className="mt-1 text-xs text-red6">Try joining the sample team with code <strong>BRH026</strong>.</p>}
    </div>
    <div className="flex shrink-0 items-center gap-3 text-xs font-semibold text-red6">
      <button onClick={preview.reset} className="min-h-11 rounded-lg border border-red5/30 bg-white px-3 hover:bg-red7">Reset applicant</button>
      <a href="/dashboard" className="flex min-h-11 items-center underline underline-offset-4">Exit preview</a>
    </div>
  </section>;
}
