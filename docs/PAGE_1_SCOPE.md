# Page 1 — approved active slice

The user's instructions for this delivery supersede the original M0 breadth.
Only SUPREME_GUIDE is enabled, with organization scope. Aseman is provisioned by
the development seed using DEV_SEED_PASSWORD, without embedding a password in
the application or inventing a mobile number. Re-running the seed never resets
an existing password or role assignment.

Active routes: /login and /guide. Active business API: authentication and the
server-authorized guide-home placeholder. Existing family/organization source
and SQL remain as reference but their modules and frontend routes are inactive.
The original DESIGN_FREEZE.md and migrations are preserved unchanged.

No Redis, queue, offline sync, PWA service worker, Push, advanced reports,
stipend, distribution, or new business workflows are implemented.

Mobile sign-in matches an existing person's registered mobile. Persian/Arabic
digits and +98 format are normalized. Ambiguous matches fail safely. No mobile
is assigned to Aseman until the user supplies it. Unknown, inactive, incorrect
password and out-of-slice accounts share the same credential error.

Local HTTP uses HttpOnly, SameSite=Strict cookies (Secure is off only for local
HTTP). Production configuration rejects non-HTTPS origins or insecure cookies.
Tokens are random, stored as SHA-256 hashes in PostgreSQL, expire absolutely,
rotate at login, and are revoked at logout. Passwords use Argon2id. Mutations
require the configured Origin; logout additionally requires a session-bound
CSRF token. Auth responses are no-store. Rate limiting is bounded, per IP and
in-process (10 attempts per 5 minutes); restart resets it. It is not a distributed
production limiter. The supplied password is temporary, but password change,
recovery and 2FA flows are not implemented or represented as completed here.

Local PostgreSQL binaries, if used for verification, are tooling rather than an
application dependency. The application continues to use pg and PostgreSQL.
