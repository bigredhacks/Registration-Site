export const acceptanceStatuses = [
  { value: 'pending', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'waitlisted', label: 'Waitlisted' },
  { value: 'rejected', label: 'Denied' },
] as const;
export const invitationStatuses = [
  { value: 'unanswered', label: 'Awaiting response' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'expired', label: 'Expired' },
] as const;
export type AnnouncementAudience = { type: 'all' }
  | { type: 'acceptance'; status: typeof acceptanceStatuses[number]['value'] }
  | { type: 'invitation'; status: typeof invitationStatuses[number]['value'] };

export function announcementAudienceLabel(audience: AnnouncementAudience): string {
  if (audience.type === 'all') return 'All applicants';
  const options = audience.type === 'acceptance' ? acceptanceStatuses : invitationStatuses;
  return `${audience.type === 'acceptance' ? 'Acceptance' : 'Invitation'} status: ${options.find(option => option.value === audience.status)!.label}`;
}
