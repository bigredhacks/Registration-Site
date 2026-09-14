import { releaseStateLabel, type AdminStudent } from './adminApprovalState';

export default function AdminInvitationStatus({ student, showDates = false }: { student: AdminStudent; showDates?: boolean }) {
  const decision = student.released_status === 'approved' ? 'Approved'
    : student.released_status === 'waitlisted' ? 'Waitlisted'
    : student.released_status === 'rejected' ? 'Not selected' : 'Under review';
  const response = student.invitation_response === 'accepted' ? 'Accepted'
    : student.invitation_response === 'declined' ? 'Declined'
    : student.released_status === 'approved' ? 'Awaiting response' : null;
  const previousResponse = !!student.invitation_response && student.released_status !== 'approved';

  if (!showDates) return <div className="admin-meta"><p>{student.released_status === 'approved' ? student.invitation_response === 'accepted' ? 'Invitation accepted' : student.invitation_response === 'declined' ? 'Invitation declined' : 'Awaiting response' : decision}</p>{previousResponse && <p className="mt-1">Previous response recorded</p>}</div>;

  return <div className="admin-meta mt-2 space-y-1">
    <p>Applicant sees: <span className="font-medium">{decision}</span></p>
    {student.released_status && student.released_status !== student.status && <p className="text-red6">{releaseStateLabel(student)}</p>}
    {showDates && student.decision_released_at && <p>Decision released {new Date(student.decision_released_at).toLocaleString()}</p>}
    {response && <p>{previousResponse ? 'Previous invitation response' : 'Invitation response'}: <span className="font-medium">{response}</span></p>}
    {showDates && student.invitation_responded_at && <p>Response recorded {new Date(student.invitation_responded_at).toLocaleString()}</p>}
  </div>;
}
