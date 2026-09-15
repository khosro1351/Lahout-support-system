# Portability verification

Verified on 2026-09-14 (UTC), using the existing repository. No product feature was added.

## Passed

- Original repository: frontend/backend type checks and production builds.
- Original repository: all 31 login and 22 access-request regression checks (53 total).
- Source-only copy in a new directory: frozen-lockfile dependency installation, including native build steps and package policy checks. The local package cache was reused; this was not a fully offline installation.
- Fresh PostgreSQL database owned by a new non-superuser development role: all four migrations applied.
- Both development seeds rebuilt one Aseman account, its SUPREME_GUIDE assignment, and three Development/Test access requests without copying existing application data.
- Windows configuration helper correctly encoded a newly supplied database password containing URL-special characters. The interactive seed helper accepted a newly chosen application password and restored the temporary process environment afterward.
- Backend/frontend startup commands from README, browser login with the new password, request list, and logout.
- Restored source-only copy: type checks, builds, and all 53 regression checks passed again.

Regression coverage includes session persistence/logout, safe errors, validation, role checks, CSRF/Origin, approval persistence, required rejection reason, immutable decisions, concurrent decisions, transaction rollback, and PostgreSQL decision history/audit.

## Environment and limits

Windows; Node 24, pnpm 11.19.0, PostgreSQL 17, repository Playwright 1.62.1, installed Google Chrome. Restoration was tested in a separate directory and fresh database on the same Windows machine, not on a second physical computer. The existing-Chrome option was tested; downloading Playwright Chromium and installing PostgreSQL through its Windows installer were not repeated. Docker was not tested or required.

## Transfer contents

The release contains source, four migrations, development seeds, regression tests, the lockfile, Windows setup helpers, a secret-free .env.example, README, and Git metadata. Local .env files, database storage/backups, installed dependencies, generated builds, test outputs, and Work files are excluded. Known local credentials and private-file patterns are checked before packaging.

A fresh development installation needs only this source archive plus the tools/dependencies and new local credentials described in README. Preserving existing database records and decisions additionally requires a separate secure PostgreSQL backup; this release does not include or create such a backup.
