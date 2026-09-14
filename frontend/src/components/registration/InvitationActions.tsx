import { useRef, useState } from 'react';
import ConfirmationDialog from '../ConfirmationDialog';
import { apiFetch } from '../../lib/api';
import { invitationPresentation, type ApplicantInvitation, type InvitationResponse } from '../../lib/invitations';

export default function InvitationActions({ registration, onRefresh, onSaved }: {
  registration: ApplicantInvitation;
  onRefresh: () => Promise<void>;
  onSaved: (registration: ApplicantInvitation) => void;
}) {
  const [choice, setChoice] = useState<InvitationResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const respond = async () => {
    if (!choice || locked.current) return;
    locked.current = true;
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/registrations/me/invitation-response', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ response: choice }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not save your response. Please try again.');
      onSaved(body);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your response. Please try again.');
    } finally {
      await onRefresh();
      setChoice(null);
      setSaving(false);
      locked.current = false;
    }
  };

  return <div className="flex flex-col gap-3">
    {invitationPresentation(registration).canRespond && <div className="flex flex-wrap gap-3">
      <button disabled={saving} onClick={() => setChoice('accepted')} className="min-h-11 rounded-lg bg-red5 px-4 font-poppins text-sm font-semibold text-white hover:bg-red3 disabled:opacity-50">Accept invitation</button>
      <button disabled={saving} onClick={() => setChoice('declined')} className="min-h-11 rounded-lg border border-red5 px-4 font-poppins text-sm font-semibold text-red6 disabled:opacity-50">Decline invitation</button>
    </div>}
    {registration.invitation_response && <p className="font-poppins text-xs text-gray-500">
      {registration.status === 'approved' ? 'Your response' : 'Your previous invitation response'}: {registration.invitation_response === 'accepted' ? 'Accepted' : 'Declined'}{registration.invitation_responded_at ? ` · ${new Date(registration.invitation_responded_at).toLocaleString()}` : ''}. Contact the organizers for corrections.
    </p>}
    {error && <p role="alert" className="font-poppins text-sm text-red6">{error}</p>}
    <ConfirmationDialog open={choice !== null} busy={saving}
      title={choice === 'accepted' ? 'Accept your invitation?' : 'Decline your invitation?'}
      confirmLabel={choice === 'accepted' ? 'Confirm acceptance' : 'Confirm decline'}
      onClose={() => setChoice(null)} onConfirm={() => void respond()}>
      <p>{choice === 'accepted' ? 'You are confirming that you will attend BigRed//Hacks.' : 'You are giving up your invitation to attend BigRed//Hacks.'} Your response is final. Contact the organizers if you later need a correction.</p>
    </ConfirmationDialog>
  </div>;
}
