import { formatRegistrationDeadline, type RegistrationClosure } from '@/lib/registrationClosure';

export default function RegistrationDeadlineNotice({ form, closed, waitlistApplication, hasSubmission }: {
  form: RegistrationClosure;
  closed: boolean;
  waitlistApplication: boolean;
  hasSubmission: boolean;
}) {
  if (!form.closes_at) return null;
  return (
    <div role="status" className="mb-4 rounded-lg bg-red7 p-3 font-poppins text-sm text-red6">
      <p>{closed ? 'Registration closed' : 'Registration closes'} · {formatRegistrationDeadline(form.closes_at, form.closes_timezone)}</p>
      {waitlistApplication && <p className="mt-2 leading-relaxed">You’re applying for the waitlist. Submitting will automatically place you on the waitlist; it does not guarantee a spot. You cannot edit your application after submitting.</p>}
      {closed && hasSubmission && <p className="mt-1">Your submitted answers are available below. Changes are closed.</p>}
      {closed && !hasSubmission && !waitlistApplication && <p className="mt-1">Applications are no longer being accepted.</p>}
    </div>
  );
}
