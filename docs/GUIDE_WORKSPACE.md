# Supreme Guide workspace — implementation notes

Baseline: `28b364a425cd0a5403a80f5ef33e6e1078c35db7`. The user explicitly authorized the additional scope in SUPREME_GUIDE_SPEC_FA.md. Historical scope-freeze reports describe previous milestones; they do not imply these newly requested domains must remain disabled.

## Architecture

The existing NestJS/Fastify + PostgreSQL + React/Vite structure is retained. GuidanceModule contains the guide-only business actions and a limited recipient workspace. There is no Redis, queue service, new frontend framework, or new operational-role administration panel.

Every guide mutation uses a PostgreSQL transaction, a shared advisory transaction lock, a current account/role recheck, history and audit writes, and notifications in the same transaction. The lock intentionally serializes guide business decisions for the current small deployment. Existing access requests retain their separate immutable organizational-approval workflow; approving an access request still does not provision an account or role. Direct guide appointments are a separate explicitly requested workflow which takes effect immediately.

Recipients can log in using the existing session mechanism to see permitted items, register coordination, and submit their own result. They cannot call guide administration or reporting endpoints. Roles are reloaded on every authenticated request; passwords and account provisioning are not exposed in guide UI.

## Data and automation

Migration `0005_guide_workspace.sql` adds the guidance schema (items, recipients, alerts, notifications, append-only history), protects audit/history and significant records from hard deletion, and enforces one supreme-guide assignment at a time. Existing four migrations are retained unchanged. Existing data is not reset.

Recipient account IDs are resolved and snapshotted when a decision is sent to people, a role, a group, or the organization. Subsequent role changes do not silently rewrite the recipient list of an already-sent decision. Confidential items are visible only to guide, creator, and snapshotted recipients. Personal receipt/result details are visible to guide and the recipient concerned.

Status is derived from stored facts: SENT, SEEN (all recipients seen), COMPLETED (all recipients submitted a nonempty result), OVERDUE. Cancellation/replacement is a separate lifecycle. Original text and changes remain in history; replacement has an explicit supersedes link. Optimistic versions block stale guide edits.

A lightweight server timer checks deadlines every 30 seconds; opening dashboard/alerts also catches up immediately. Unique keys prevent duplicate overdue alerts/notifications. No external scheduler is required. Looking at an alert does not close it. Result completion closes alerts associated with that item. A cancelled/replaced item retains an unresolved alert until its outcome is handled. A linked follow-up mission can record the result and resolve the original alert; cancellation alone is not evidence that the work was done.

Development seed `seed-guide-dev.ts` adds clearly labeled test people, a group, a minimal family record and a council resolution. It refuses production and does not reset existing passwords or final decisions. New development recipients are GuideDemoHelper and GuideDemoManager; their password is chosen through the same temporary local seed environment, never committed.

## Routes

Guide UI: `/guide`, `/guide/people`, `/guide/people/:id`, `/guide/appointments`, `/guide/groups`, `/guide/groups/:id`, `/guide/leadership`, `/guide/coordination`, `/guide/council-decisions`, `/guide/alerts`, `/guide/urgent`, `/guide/reports`, `/guide/families/:id`.

Shared limited recipient UI: `/workspace`, `/workspace/items/:id`, `/workspace/notifications`. Existing `/login` and access-request routes are preserved.

All API paths below are prefixed `/api/v1`:

- GET `/guide/dashboard`, `/guide/metadata`, `/guide/people`, `/guide/people/:id`, `/guide/appointments`
- POST `/guide/people/:id/assign`, `/guide/people/:id/end-role`
- GET/POST `/guide/groups`; GET `/guide/groups/:id`
- POST `/guide/groups/:id/leader`, `/guide/groups/:id/dissolve`
- POST `/guide/items`, `/guide/items/:id/action`
- GET `/guide/alerts`, `/guide/reports`, `/guide/families/:id`
- POST `/guide/reports/sponsor`
- GET `/workspace/items`, `/workspace/items/:id`, `/workspace/notifications`
- POST `/workspace/items/:id/seen`, `/workspace/items/:id/complete`, `/workspace/coordination`, `/workspace/notifications/:id/seen`

## Deliberately deferred / integration boundaries

- PDF/Excel document rendering: sponsor preview and a whitelisted JSON export are provided. No claim of PDF/Excel completion.
- Support type, assessed need level, and support-impact reporting require future domain data; those filters are not fabricated. Current reports use existing family/group/person/decision data.
- Production council-resolution ingestion and maintenance of the people registry belong to their future originating workflows. The guide can review existing records and development examples, but does not enter people manually or conduct legal voting.
- Account provisioning/password management, transfer of families after dissolution, separate operational-role management panels, and supreme-guide succession remain outside this delivery.
- Internal notifications are persisted; external Push/SMS/email are not implemented.

Read TEST results for actual verification, not this architectural description.
