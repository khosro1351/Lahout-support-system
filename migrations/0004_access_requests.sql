BEGIN;

CREATE TABLE identity.access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_name varchar(200) NOT NULL CHECK (length(trim(person_name)) > 0),
  request_type varchar(40) NOT NULL CHECK (request_type IN ('CREATE_ACCOUNT','ADD_ROLE','END_ROLE','CHANGE_SCOPE','REACTIVATE_ACCOUNT')),
  proposed_role varchar(50) REFERENCES identity.roles(code),
  scope_type varchar(30) CHECK (scope_type IN ('ORGANIZATION','GROUP')),
  scope_label varchar(200),
  scope_id uuid REFERENCES organization.groups(id),
  reason text NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 2000),
  requested_by uuid NOT NULL REFERENCES identity.accounts(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  status varchar(60) NOT NULL DEFAULT 'PENDING_GUIDE_APPROVAL'
    CHECK (status IN ('PENDING_GUIDE_APPROVAL','APPROVED_PENDING_TECHNICAL_IMPLEMENTATION','REJECTED')),
  is_development boolean NOT NULL DEFAULT false,
  development_key varchar(100) UNIQUE,
  CHECK (development_key IS NULL OR is_development),
  CHECK (scope_id IS NULL OR scope_type = 'GROUP')
);

CREATE INDEX access_requests_date_idx ON identity.access_requests (requested_at DESC, id);

CREATE TABLE identity.access_request_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL UNIQUE REFERENCES identity.access_requests(id),
  decided_by uuid NOT NULL REFERENCES identity.accounts(id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  decision varchar(10) NOT NULL CHECK (decision IN ('APPROVED','REJECTED')),
  reason text,
  CHECK ((decision = 'REJECTED' AND reason IS NOT NULL AND length(trim(reason)) BETWEEN 1 AND 2000)
    OR (decision = 'APPROVED' AND reason IS NULL))
);

CREATE FUNCTION identity.protect_final_access_request() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status <> 'PENDING_GUIDE_APPROVAL' THEN
    RAISE EXCEPTION 'A decided access request is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER protect_final_access_request BEFORE UPDATE OR DELETE ON identity.access_requests
  FOR EACH ROW EXECUTE FUNCTION identity.protect_final_access_request();

CREATE FUNCTION identity.protect_access_decision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Access decisions are append-only';
END;
$$;
CREATE TRIGGER protect_access_decision BEFORE UPDATE OR DELETE ON identity.access_request_decisions
  FOR EACH ROW EXECUTE FUNCTION identity.protect_access_decision();

COMMIT;
