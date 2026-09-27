BEGIN;
CREATE TABLE assessment.health_forms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 membership_id uuid NOT NULL REFERENCES family.family_memberships(id),
 active boolean NOT NULL DEFAULT true,
 payload jsonb NOT NULL DEFAULT '{}', version integer NOT NULL DEFAULT 1,
 created_by uuid NOT NULL REFERENCES identity.accounts(id), updated_by uuid NOT NULL REFERENCES identity.accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_active_health_form ON assessment.health_forms(membership_id) WHERE active;
CREATE FUNCTION assessment.health_form_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR NOT OLD.active THEN RAISE EXCEPTION 'Historical health form is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER health_form_guard BEFORE UPDATE OR DELETE ON assessment.health_forms FOR EACH ROW EXECUTE FUNCTION assessment.health_form_guard();
CREATE TABLE assessment.health_reviews (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES family.families(id),
 state text NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','SUBMITTED','RETURNED','APPROVED')),
 version integer NOT NULL DEFAULT 1, created_by uuid NOT NULL REFERENCES identity.accounts(id),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_open_health_review ON assessment.health_reviews(family_id) WHERE state<>'APPROVED';
CREATE TABLE assessment.health_submissions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),review_id uuid NOT NULL REFERENCES assessment.health_reviews(id),
 revision integer NOT NULL,snapshot jsonb NOT NULL,submitted_by uuid NOT NULL REFERENCES identity.accounts(id),
 submitted_at timestamptz NOT NULL DEFAULT now(),UNIQUE(review_id,revision)
);
CREATE TABLE assessment.health_decisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),submission_id uuid NOT NULL UNIQUE REFERENCES assessment.health_submissions(id),
 decision text NOT NULL CHECK(decision IN ('APPROVED','RETURNED')),reason text,
 decided_by uuid NOT NULL REFERENCES identity.accounts(id),decided_at timestamptz NOT NULL DEFAULT now(),
 CHECK(decision='APPROVED' OR length(trim(reason))>0)
);
CREATE TRIGGER health_submission_immutable BEFORE UPDATE OR DELETE ON assessment.health_submissions FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TRIGGER health_decision_immutable BEFORE UPDATE OR DELETE ON assessment.health_decisions FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TRIGGER health_review_no_delete BEFORE DELETE ON assessment.health_reviews FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE FUNCTION assessment.health_review_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF OLD.state='APPROVED' THEN RAISE EXCEPTION 'Approved health review is immutable'; END IF;
 IF NOT(NEW.state=OLD.state OR (OLD.state IN ('DRAFT','RETURNED') AND NEW.state='SUBMITTED') OR (OLD.state='SUBMITTED' AND NEW.state IN ('APPROVED','RETURNED'))) THEN RAISE EXCEPTION 'Invalid health transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER health_review_guard BEFORE UPDATE ON assessment.health_reviews FOR EACH ROW EXECUTE FUNCTION assessment.health_review_guard();
COMMIT;
