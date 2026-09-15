import { useEffect, useRef, useState } from 'react';
import ConfirmationDialog from '../ConfirmationDialog';
import { formatRegistrationDeadline } from '../../lib/registrationClosure';
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
  const [deadline, setDeadline] = useState<{ deadline: string | null; time_zone: string; offset: number } | null>(null);
  const [deadlineError, setDeadlineError] = useState('');
  const [clock, setClock] = useState(Date.now());
  const [reload, setReload] = useState(0);
  const refresh = useRef(onRefresh); refresh.current = onRefresh;
  useEffect(() => {
    let current = true;
    const load = async () => {
      try {
        const response = await apiFetch('/api/registrations/me/invitation-settings');
        const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not load the invitation deadline.');
        if (current) {
          setDeadline({ ...body, offset: Date.parse(body.server_now) - Date.now() }); setDeadlineError('');
          if (body.expired_count) void refresh.current();
        }
      } catch (cause) { if (current) setDeadlineError(cause instanceof Error ? cause.message : 'Could not load the invitation deadline.'); }
    };
    void load();
    const poll = setInterval(() => void load(), 60000);
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => { current = false; clearInterval(poll); clearInterval(timer); };
  }, [reload]);
  const deadlinePassed = !!deadline?.deadline && clock + deadline.offset >= Date.parse(deadline.deadline);
  const canRespond = invitationPresentation(registration).canRespond && !!deadline && !deadlineError && !deadlinePassed;
  useEffect(() => { if (!canRespond) setChoice(null); }, [canRespond]);

  const respond = async () => {
    if (!choice || locked.current || !canRespond) return;
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
    {registration.status === 'approved' && !registration.invitation_response && deadline?.deadline && <p className="font-poppins text-sm text-red6">
      {deadlinePassed ? 'The acceptance deadline has passed. Your invitation is no longer available.' : `Accept by ${formatRegistrationDeadline(deadline.deadline, deadline.time_zone)}.`}
    </p>}
    {deadlineError && registration.status === 'approved' && !registration.invitation_response && <p role="alert" className="text-sm text-red6">{deadlineError} <button onClick={() => setReload(reload + 1)}>Retry</button></p>}
    {canRespond && <div className="flex flex-wrap gap-3">
      <button disabled={saving} onClick={() => setChoice('accepted')} className="min-h-11 rounded-lg bg-red5 px-4 font-poppins text-sm font-semibold text-white hover:bg-red3 disabled:opacity-50">Accept invitation</button>
      <button disabled={saving} onClick={() => setChoice('declined')} className="min-h-11 rounded-lg border border-red5 px-4 font-poppins text-sm font-semibold text-red6 disabled:opacity-50">Decline invitation</button>
    </div>}
    {registration.invitation_response && !registration.invitation_expired_at && <p className="font-poppins text-xs text-gray-500">
      {registration.status === 'approved' ? 'Your response' : 'Your previous invitation response'}: {registration.invitation_response === 'accepted' ? 'Accepted' : 'Declined'}{registration.invitation_responded_at ? ` · ${new Date(registration.invitation_responded_at).toLocaleString()}` : ''}. Contact the organizers for corrections.
    </p>}
    {error && <p role="alert" className="font-poppins text-sm text-red6">{error}</p>}
    <ConfirmationDialog open={choice !== null && canRespond} busy={saving}
      title={choice === 'accepted' ? 'Accept your invitation?' : 'Decline your invitation?'}
      confirmLabel={choice === 'accepted' ? 'Confirm acceptance' : 'Confirm decline'}
      onClose={() => setChoice(null)} onConfirm={() => void respond()}>
      <p>{choice === 'accepted' ? 'You are confirming that you will attend BigRed//Hacks.' : 'You are giving up your invitation to attend BigRed//Hacks.'} Your response is final. Contact the organizers if you later need a correction.</p>
    </ConfirmationDialog>
  </div>;
}
