# Server credentials and private product images

The storefront and user authentication use the selected project's public key.
Ordinary session verification and membership reads do not require an
administrative key. Private image signing and privileged server operations do.

## One-time deployment setup

The selected project is `ybhrmcdlgyccywpmiucz`. Open its
[API Keys settings](https://supabase.com/dashboard/project/ybhrmcdlgyccywpmiucz/settings/api-keys)
and use a server secret (`sb_secret_…`) or its legacy `service_role` key.
In [Lovable](https://lovable.dev/projects/4d4aad01-9bf4-4d8b-acab-e51a06a17c63),
open Cloud → Secrets and set:

| Secret name | Value |
| --- | --- |
| `MUSLLY_SUPABASE_PROJECT_ID` | `ybhrmcdlgyccywpmiucz` |
| `MUSLLY_SUPABASE_SERVICE_ROLE_KEY` | The selected project's server secret |

Redeploy after changing secrets. Keep these values in the deployment secret
store, never in GitHub, chat, browser storage, or a `VITE_` variable. Managed
`SUPABASE_*` credentials for the old project are not a substitute. An invalid
custom binding fails closed instead of falling back to another key.

An owner or system administrator can open `/admin-diagnostics` and run the
read-only server connection check. It returns the selected project, configuration
status, a real Storage API verification result, and the visibility of the two
product-image buckets. It does not return credentials, signed URLs, unrelated
bucket names or SDK error bodies. A syntactically matching key is not proof of
authenticity; a successful Supabase response verifies the connection.

## Product image rules

- Only `product-images` and `catalog-media` are product-image buckets.
- References must identify an object below the exact product ID. Arbitrary
  buckets, URLs, traversal and ambiguous encoded paths are rejected.
- Public responses sign only approved media belonging to approved public
  products. Raw storage paths are not part of the public product detail DTO.
- Administrative writes require a verified user, organization ownership and
  catalog permissions before accessing privileged storage. Upload and approval
  are separate permissions.
- Uploads accept bounded JPEG, PNG or WebP files with matching file signatures.
  The server creates a missing private `product-images` bucket on the first
  authorized upload. It does not turn an existing public bucket private or
  expose another bucket.
- Persistent product image references remain canonical bucket/path references;
  short-lived signed URLs are generated for display. Visible catalog queries
  refresh before expiry; signed-image responses are excluded from localStorage.
- Authorized reviewers can approve pending images from catalog administration.
  Pending previews remain inside the owning organization's administration.
- Deletion checks storage errors and the metadata result. Storage and database
  writes are not an atomic transaction; failures must remain visible and
  retryable without claiming successful cleanup.

Private prescription/invoice OCR inputs must use the verified caller's own
canonical upload prefix. Administrative roles do not authorize arbitrary other
users' private object paths. Product barcode uploads use the same validated
product-image service as catalog administration.

The database also enforces media approval and provenance for direct Data API
writes. Anonymous callers cannot select raw media rows. A restrictive policy
prevents upload-only users from inserting approved media, and an invoker trigger
preserves product/object/uploader identity during later review.

At the 2026-10-27 read-only inventory, both product-image buckets and registered
media were absent. Fifteen public catalog products had no organization ID and
twelve belonged to an organization. Public visibility does not establish write
ownership. Shared/imported products require a deliberate ownership decision
before administrative image edits; this change does not reassign them.

## Verification and rotation

Tests cover mismatched and missing bindings, rejection of public credentials,
redacted diagnostics, server authorization, request isolation, image permissions,
storage failure recovery, approval and key rotation.
Privileged clients are rebuilt when a secret changes, and removing it disables
new privileged access immediately. Rotate keys in Supabase and replace the
deployment secret using the same secure setup flow, then rerun diagnostics.
Public browsing and authentication remain independent of the service credential.

The connected Supabase tools currently expose publishable keys only; they cannot
retrieve a private server credential. Lovable's connected tools do not expose a
Secrets setter. Consequently a deployment owner must perform the secure entry
step above. Do not recover secrets through SQL, Vault inspection or source files.

Before declaring image operations verified in production, complete the real
connection check and exercise an authorized image workflow in a test environment.
Unit tests with synthetic keys and successful public browsing do not establish
that a private credential has been installed.
