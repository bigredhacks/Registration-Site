export type InvitationResponse = 'accepted' | 'declined';

export interface ApplicantInvitation {
  status?: string | null;
  decision_released_at?: string | null;
  invitation_response?: InvitationResponse | null;
  invitation_responded_at?: string | null;
}

export function invitationPresentation(registration: ApplicantInvitation) {
  if (registration.status === 'approved') {
    if (registration.invitation_response === 'accepted') return {
      headline: 'Invitation accepted', body: "You're confirmed for BigRed//Hacks. We look forward to seeing you!", canRespond: false,
    };
    if (registration.invitation_response === 'declined') return {
      headline: 'Invitation declined', body: 'You have declined your invitation. Thank you for letting us know.', canRespond: false,
    };
    return { headline: "You're invited!", body: 'Your application has been approved. Please accept or decline your invitation below.', canRespond: true };
  }
  if (registration.status === 'waitlisted') return {
    headline: 'Waitlisted', body: "You're on the waitlist. We'll email you if a place becomes available.", canRespond: false,
  };
  if (registration.status === 'rejected') return {
    headline: 'Not selected', body: 'Thank you for applying. We are unable to offer you a place at BigRed//Hacks.', canRespond: false,
  };
  return { headline: 'Under review', body: 'Your application is under review. We will email you when your decision is available.', canRespond: false };
}
