import AdminInvitationStatus from './AdminInvitationStatus';
import { decisionOptions } from './adminApprovalState';
import { applicationAnswers, formatUserAnswer, PROFILE_STATUS_CLASS, profileStateLabel, userName, type AdminUserDetail as UserDetail } from './adminUsersState';

const PROFILE_FIELDS = [
  ['first_name', 'First Name'], ['last_name', 'Last Name'], ['phone_number', 'Phone Number'],
  ['age_range', 'Age'], ['graduation_year', 'Graduation Year'], ['school', 'University'],
  ['country', 'Country'], ['level_of_study', 'Level of Study'], ['major', 'Major'],
  ['gender', 'Gender'], ['dietary_restrictions', 'Dietary Restrictions'], ['shirt_size', 'Shirt Size'],
  ['linkedin', 'LinkedIn'],
];

const timestamp = (value: string | null | undefined) => value
  ? `${new Date(value).toLocaleString(undefined, { timeZone: 'UTC' })} UTC` : '—';

export default function AdminUserDetail({ detail, formTitle }: { detail: UserDetail; formTitle: string }) {
  const { account, application, profile } = detail;
  return <>
    <h2>{userName(account)}</h2>
    <section aria-label="Account information" className="mt-5">
      <h3 className="font-semibold mb-2">Account</h3>
      <dl className="admin-answer-list">
        <div><dt>Email</dt><dd>{account.email || '—'}</dd></div>
        <div><dt>User ID</dt><dd>{account.user_id}</dd></div>
        <div><dt>Signed up</dt><dd>{timestamp(account.created_at)}</dd></div>
        <div><dt>Email verified</dt><dd>{account.email_confirmed_at ? timestamp(account.email_confirmed_at) : 'Not verified'}</dd></div>
        <div><dt>Last sign-in</dt><dd>{account.last_sign_in_at ? timestamp(account.last_sign_in_at) : 'Never signed in'}</dd></div>
      </dl>
    </section>
    <section aria-label="User profile" className="mt-6">
      <h3 className="font-semibold mb-2">Profile</h3>
      <p className="admin-meta mb-3"><span className={`admin-status ${PROFILE_STATUS_CLASS[detail.profile_state]}`}>{profileStateLabel(detail.profile_state)}</span> · {detail.profile_pct}% complete</p>
      {detail.missing_profile_fields.length > 0 && <p className="admin-meta mb-3">Missing: {detail.missing_profile_fields.join(', ')}</p>}
      {!profile ? <p className="admin-meta">No profile saved.</p> : <dl className="admin-answer-list">
        {PROFILE_FIELDS.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{formatUserAnswer(profile[key])}</dd></div>)}
      </dl>}
    </section>
    <section aria-label="User application" className="mt-6">
      <h3 className="font-semibold mb-2">Application · {formTitle}</h3>
      {!application ? <p className="admin-meta">No application submitted for this form.</p> : <>
        <p className="admin-meta">Submitted {timestamp(application.created_at)}</p>
        <p className="admin-meta mt-2">Saved decision: <span className={`admin-status admin-status-${application.status}`}>{decisionOptions.find(option => option.value === application.status)?.label ?? application.status}</span></p>
        {detail.form_key === 'registration' && <AdminInvitationStatus student={application} showDates />}
        <p className="admin-meta mt-2">{application.checked_in ? `Checked in${application.checked_in_at ? ` · ${timestamp(application.checked_in_at)}` : ''}` : 'Not checked in'}</p>
        <p className="admin-meta my-3">Manage decisions in Approvals.</p>
        <dl className="admin-answer-list">{Object.entries(applicationAnswers(application)).map(([key, value]) => <div key={key}>
          <dt>{key.replace(/_/g, ' ')}</dt><dd>{formatUserAnswer(value)}</dd>
        </div>)}</dl>
      </>}
    </section>
  </>;
}
