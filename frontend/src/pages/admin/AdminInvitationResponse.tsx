import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import ConfirmationDialog from '@/components/ConfirmationDialog';
import { studentName, type AdminStudent } from './adminApprovalState';

export default function AdminInvitationResponse({ student, onSaved }: { student: AdminStudent; onSaved: (student: AdminStudent) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (student.released_status !== 'approved' || !student.invitation_response || !student.invitation_responded_at) return null;
  const response = student.invitation_response === 'accepted' ? 'declined' : 'accepted';
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/admin/approval/invitation-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: student.id, response, expected_response: student.invitation_response, expected_responded_at: student.invitation_responded_at }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not change the invitation response.');
      onSaved(body.data);
      setOpen(false);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not change the invitation response.');
    } finally { setSaving(false); }
  };
  return <div className="mt-3">
    <button type="button" className="admin-button" onClick={() => { setError(''); setOpen(true); }}>Change invitation response</button>
    <ConfirmationDialog open={open} title="Change invitation response?" busy={saving}
      confirmLabel={`Change to ${response}`} onClose={() => setOpen(false)} onConfirm={() => void save()}>
      <p>Change {studentName(student)}’s response from <strong>{student.invitation_response}</strong> to <strong>{response}</strong>?</p>
      <p className="mt-2">This updates their dashboard and invitation totals immediately. The response timestamp will be updated. No email will be sent.</p>
      {error && <p role="alert" className="mt-2 text-red6">{error}</p>}
    </ConfirmationDialog>
  </div>;
}
