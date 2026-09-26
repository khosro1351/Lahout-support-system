BEGIN;
-- Screening only; no scoring, submission or review lifecycle.
CREATE TABLE assessment.health_screenings (
 membership_id uuid PRIMARY KEY REFERENCES family.family_memberships(id) ON DELETE RESTRICT,
 answer text NOT NULL CHECK(answer IN ('NO','YES','UNKNOWN')),
 source text NOT NULL CHECK(source IN ('INTERVIEW','OBSERVATION','VISIT','DOCUMENT','OTHER')),
 source_detail text NOT NULL DEFAULT '' CHECK(length(source_detail)<=500),
 notes text NOT NULL DEFAULT '' CHECK(length(notes)<=2000),
 created_by uuid NOT NULL REFERENCES identity.accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_by uuid NOT NULL REFERENCES identity.accounts(id),
 updated_at timestamptz NOT NULL DEFAULT now(),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 CHECK(source<>'OTHER' OR length(trim(source_detail))>0)
);
COMMIT;
