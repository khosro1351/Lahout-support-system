# Review data-model gap analysis

Baseline: 1f2fdee2d28329254b072e2046f1f6ea37256e54. The user explicitly replaces the guide's command/mission workflow with executive-submitted permission verification and restricts council intervention to stop/review. Legacy records remain readable and auditable; old creation/intervention APIs must not bypass the new rules.

Existing: people/accounts/current scoped roles, groups, minimal families/memberships, access requests, immutable guidance history, item recipients, notifications and alerts.

Required additions: fixed group numbers; atomic family transfer and reversible group inactivity; contextual person/group/family alerts; permission-verification records; council attachments/execution state; family assessment/research snapshots; support, stipend, distribution and activity reporting sources; aggregate reporting views and consciously selected export fields.

Assessment scoring rules are not defined in this specification. Store imported/scored observations with provenance and individual answers/scores; do not invent operational eligibility thresholds or an assessment workflow. Development snapshots are explicitly synthetic examples. Reports compute from stored records, never from hardcoded seed arrays. Support/payment/distribution execution workflows remain future source integrations, while their report models, filters and exports are implemented here.

Case workspace and aggregate reporting use separate services/routes/UI over shared persisted facts. A single case component serves authorized guide and group-scoped accounts; available actions come from server authorization. Export catalog exposes all business columns of each report view, not authentication credentials. PDF uses the already-installed Playwright/Chromium runtime; Excel is a standard OOXML workbook. Print/PDF share an A4 document template.

Performance is a descriptive average of observed timeliness, completion, freshness and alert-resolution percentages; absent observations are null, not perfect scores. Show each component and responsibility load alongside it. Do not rank by raw activity volume.
