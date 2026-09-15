BEGIN;

CREATE TABLE identity.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name varchar(100) NOT NULL,
  last_name varchar(100) NOT NULL,
  mobile varchar(20),
  national_id varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX people_national_id_uq
  ON identity.people (national_id)
  WHERE national_id IS NOT NULL;

CREATE INDEX people_name_trgm_idx
  ON identity.people USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

CREATE TABLE identity.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES identity.people(id) ON DELETE RESTRICT,
  username varchar(80) NOT NULL,
  password_hash text NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','PENDING_ACTIVATION','SECURITY_LOCKED','SUSPENDED','DISABLED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX accounts_username_lower_uq
  ON identity.accounts (lower(username));

CREATE TABLE identity.roles (
  code varchar(50) PRIMARY KEY,
  label_fa varchar(100) NOT NULL
);

CREATE TABLE identity.role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES identity.accounts(id) ON DELETE RESTRICT,
  role_code varchar(50) NOT NULL REFERENCES identity.roles(code) ON DELETE RESTRICT,
  scope_type varchar(30) NOT NULL CHECK (scope_type IN ('ORGANIZATION','GROUP')),
  scope_id uuid,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_to timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (scope_type = 'ORGANIZATION' AND scope_id IS NULL)
    OR
    (scope_type = 'GROUP' AND scope_id IS NOT NULL)
  )
);

CREATE INDEX role_assignments_account_idx
  ON identity.role_assignments (account_id, role_code, valid_to);

CREATE TABLE identity.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES identity.accounts(id) ON DELETE RESTRICT,
  token_hash char(64) NOT NULL UNIQUE,
  csrf_token varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz
);

CREATE INDEX auth_sessions_active_idx
  ON identity.auth_sessions (account_id, expires_at)
  WHERE revoked_at IS NULL;

CREATE TABLE organization.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(30) NOT NULL UNIQUE,
  name varchar(150) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE','DISSOLVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO identity.roles (code, label_fa) VALUES
  ('SUPREME_GUIDE', 'راهبر عالی کانون'),
  ('EXECUTIVE_MANAGER', 'مدیر اجرایی'),
  ('COUNCIL_MEMBER', 'عضو شورا'),
  ('GROUP_LEADER', 'سرگروه'),
  ('HELPER', 'همیار'),
  ('TECH_ADMIN', 'مدیر فنی')
ON CONFLICT (code) DO UPDATE SET label_fa = EXCLUDED.label_fa;

COMMIT;
