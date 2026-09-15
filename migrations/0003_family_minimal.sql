BEGIN;

CREATE SEQUENCE family.family_code_seq START WITH 1;

CREATE TABLE family.families (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_code varchar(20) NOT NULL UNIQUE,
  status varchar(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','NEEDS_REVIEW','TEMPORARILY_INACTIVE','UNREACHABLE','MIGRATED','NO_CURRENT_NEED','EXITED_SUPPORT','CLOSED')),
  current_group_id uuid NOT NULL REFERENCES organization.groups(id) ON DELETE RESTRICT,
  neighborhood varchar(150),
  created_by uuid NOT NULL REFERENCES identity.accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  version integer NOT NULL DEFAULT 1
);

CREATE INDEX families_group_idx ON family.families(current_group_id, status);
CREATE INDEX families_code_trgm_idx ON family.families USING gin (family_code gin_trgm_ops);

CREATE TABLE family.family_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family.families(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES identity.people(id) ON DELETE RESTRICT,
  relationship_code varchar(30) NOT NULL,
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX family_memberships_family_idx ON family.family_memberships(family_id, valid_to);

CREATE TABLE family.head_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id uuid NOT NULL REFERENCES family.families(id) ON DELETE RESTRICT,
  person_id uuid NOT NULL REFERENCES identity.people(id) ON DELETE RESTRICT,
  valid_from date NOT NULL DEFAULT current_date,
  valid_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX one_current_head_per_family_uq
  ON family.head_history (family_id)
  WHERE valid_to IS NULL;

COMMIT;
