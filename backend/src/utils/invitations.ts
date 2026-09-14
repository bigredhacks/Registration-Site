export interface InvitationFields {
  form_key?: string | null;
  status?: string | null;
  released_status?: string | null;
  decision_released_at?: string | null;
  invitation_response?: 'accepted' | 'declined' | null;
  invitation_responded_at?: string | null;
}

export function applicantDecision<T extends InvitationFields>(row: T) {
  const { released_status, ...visible } = row;
  return {
    ...visible,
    status: (row.form_key ?? 'registration') === 'registration' ? released_status ?? 'pending' : row.status,
  };
}

export const protectedInvitationFields = [
  'released_status', 'decision_released_at', 'invitation_response', 'invitation_responded_at',
] as const;

export function invitationErrorStatus(code?: string) {
  return code === 'PT400' ? 400 : code === 'PT404' ? 404 : code === 'PT409' ? 409 : 500;
}
