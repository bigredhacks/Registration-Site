import { useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { useAdminSelection } from './AdminSelectionContext';
import { buildReleasePreview, studentName, type AdminStudent } from './adminApprovalState';

export default function AdminDecisionRelease() {
  const { selected, formKey, busy, release } = useAdminSelection();
  const [preview, setPreview] = useState<ReturnType<typeof buildReleasePreview> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  useEffect(() => () => { request.current++; }, [formKey]);
  const prepare = async () => {
    const current = ++request.current;
    const ids = [...selected.keys()];
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/approval/selection?form_key=registration');
      if (!res.ok) throw new Error();
      const body: { data: AdminStudent[] } = await res.json();
      if (current === request.current) setPreview(buildReleasePreview(ids, body.data));
    } catch {
      if (current === request.current) setError('Could not refresh selected decisions. Try again.');
    } finally {
      if (current === request.current) setLoading(false);
    }
  };
  if (formKey !== 'registration') return null;

  return <div className="admin-release-action">
    <button className="admin-button admin-button-primary" disabled={busy || loading || !selected.size} onClick={() => void prepare()}>{loading ? 'Refreshing decisions…' : 'Release decisions…'}</button>

    {error && <p role="alert" className="text-red6 mt-2">{error}</p>}
    {preview && !preview.decisions.length && <p role="status" className="admin-meta mt-2">No selected decisions are ready to release. Pending or missing applications remain selected.</p>}
    <ConfirmationDialog open={!!preview?.decisions.length} title="Release selected decisions?" busy={busy}
      confirmLabel={`Release ${preview?.decisions.length ?? 0} decisions`} onClose={() => setPreview(null)}
      onConfirm={() => { if (preview) void release(preview.decisions).finally(() => setPreview(null)); }}>
      <p>Applies to the entire selection, including applicants outside this list. Makes decisions visible on dashboards. Does not send emails.</p>
      <p>Applicants will see these decisions immediately. Approved applicants without a recorded response can accept or decline. Previous responses are kept. No emails will be sent.</p>
      <p className="mt-2">{['approved', 'waitlisted', 'rejected'].map(status => `${preview?.students.filter(student => student.status === status).length ?? 0} ${status}`).join(' · ')}</p>
      {!!preview?.skipped && <p className="mt-2">{preview.skipped} pending or missing applications will be skipped and remain selected.</p>}
      <ul className="mt-3 max-h-56 overflow-y-auto divide-y divide-gray-100">
        {preview?.students.map(student => <li key={student.id} className="py-2"><p>{studentName(student)} · {student.status}</p><p className="text-xs text-gray-500 break-all">{student.email}</p>{student.invitation_response && <p className="text-xs text-gray-500">Previous response kept: {student.invitation_response === 'accepted' ? 'Accepted' : 'Declined'}</p>}</li>)}
      </ul>
    </ConfirmationDialog>
  </div>;
}
