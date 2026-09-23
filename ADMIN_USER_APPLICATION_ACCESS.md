# Later task: individual application access

## Intended behavior

From Admin → Users, grant one account access to a selected application after its deadline. The exception should permit both a first submission and edits to an existing submission. Decisions remain in Approvals.

The Users tab supplies a dedicated read-only detail component, stable account UUID, selected `form_key`, and nullable registration ID. It introduces no access overrides, write endpoints, placeholder controls, or changes to application availability.

## Decisions for the later session

- Whether grants expire, and how admins revoke them.
- Whether a grant also overrides an inactive form or only its deadline.
- Which edit operations a grant permits, including deletion and resume replacement.
- What audit information and applicant-facing explanation accompany a grant.

## Implementation touchpoints

- Add a per-user/per-form grant and authenticated admin action in Users details, with reviewed grant/revoke feedback.
- Enforce the same effective availability policy in submission and edit routes, resume upload/persistence, and any permitted deletion operation.
- Update the `create_registration_with_email` database function: it independently rejects closed and inactive forms, so a route-only exception is insufficient.
- Update form readability and applicant dashboard/application UI so a granted account can open the form and use the authorized operations.
- Preserve normal deadlines for everyone else and all existing decision/release behavior.

## Acceptance coverage

Test a never-submitted account and an existing applicant after closure; another account without a grant; a grant for another form; expiration/revocation; the chosen inactive-form behavior; and concurrent submission or revocation. Verify the backend and database enforce the same policy and that ordinary applicants remain closed out.

This document is a handoff, not an implemented access feature.
