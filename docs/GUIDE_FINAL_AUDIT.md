# Implementation audit — final guide specification

Baseline: 095f1ec780433503f10b6e27bca68c8c673e5d1f; attached ZIP SHA256 verified. Working tree was clean. Existing NestJS/Fastify/PostgreSQL/React architecture is retained.

Reuse: sessions/CSRF, role assignments and their transactions, family transfer and group state transitions, immutable guidance history/audit, existing PostgreSQL reporting sources, XLSX writer, shared case UI, migrations 1–6, regression test harness.

Replace or correct: permission-centered dashboard; council intervention UI/API (archive only); general guide alert resolution; generic report/column explorer; raw enum fallback; non-organizational people; group structural controls location; missing assessment and alert rule versioning.

Additive migration 7: scoring-model versions and immutable assessment snapshots; normalized alert ownership/lifecycle/dedup; separate reminders; council archive metadata/full-text indexes; evidence-backed source history; reporting metadata. Existing records and prior migrations are preserved. Historical imported profile observations are not falsely presented as scored assessments.

The user subsequently supplied the complete approved response tables and shared-form specification. Additive migration 8 stores the approved scoring model 1.0 and a separate, linked form schema; draft editing and immutable submission reuse one renderer. Capacity numeric thresholds and a meaningful-change tolerance remain unspecified: no invented capacity cutoffs or people ranking are introduced. Comparisons display actual score changes and explicit workload facts.

Intentional removals: access/permission modules from guide navigation, permission creation/decision workflow, council stop/review actions, guide as general operational resolver, performance rankings, technical database fields from reports. Historical data and login/access-request service regression remain preserved.
