BEGIN;
ALTER TABLE family.families DROP CONSTRAINT families_status_check;
ALTER TABLE family.families ADD CONSTRAINT families_status_check CHECK(status IN ('NEEDS_CLASSIFICATION','ACTIVE','NEEDS_REVIEW','TEMPORARILY_INACTIVE','UNREACHABLE','MIGRATED','NO_CURRENT_NEED','EXITED_SUPPORT','CLOSED'));
CREATE SCHEMA family_import;
CREATE TABLE family_import.batches(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),group_id uuid NOT NULL REFERENCES organization.groups(id),
 uploaded_by uuid NOT NULL REFERENCES identity.accounts(id),filename text NOT NULL,file_content bytea NOT NULL,file_hash text NOT NULL,
 state text NOT NULL CHECK(state IN ('PREVIEW','INVALID','IMPORTED','VOID')),version integer NOT NULL DEFAULT 1,
 errors jsonb NOT NULL DEFAULT '[]',created_at timestamptz NOT NULL DEFAULT now(),confirmed_at timestamptz,confirmed_by uuid REFERENCES identity.accounts(id),
 voided_at timestamptz,voided_by uuid REFERENCES identity.accounts(id),void_reason text
);
CREATE TABLE family_import.rows(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),batch_id uuid NOT NULL REFERENCES family_import.batches(id),sheet text NOT NULL,row_number integer NOT NULL,
 data jsonb NOT NULL,errors jsonb NOT NULL DEFAULT '[]',classification text NOT NULL CHECK(classification IN ('VALID','SUSPECT','DUPLICATE','ERROR','EMPTY')),
 duplicate_reasons jsonb NOT NULL DEFAULT '[]',decision text CHECK(decision IN ('IMPORT','SKIP')),decision_reason text,decided_by uuid REFERENCES identity.accounts(id),decided_at timestamptz,
 family_id uuid REFERENCES family.families(id),UNIQUE(batch_id,row_number)
);
CREATE TABLE family_import.families(
 family_id uuid PRIMARY KEY REFERENCES family.families(id),batch_id uuid NOT NULL REFERENCES family_import.batches(id),row_id uuid NOT NULL UNIQUE REFERENCES family_import.rows(id),
 members_confirmed_at timestamptz,members_confirmed_by uuid REFERENCES identity.accounts(id),activity_at timestamptz,activity_source text
);
CREATE INDEX import_batch_group ON family_import.batches(group_id,created_at);
CREATE TRIGGER import_batch_no_delete BEFORE DELETE ON family_import.batches FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER import_row_no_delete BEFORE DELETE ON family_import.rows FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER import_family_no_delete BEFORE DELETE ON family_import.families FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE FUNCTION family_import.batch_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.group_id,NEW.uploaded_by,NEW.filename,NEW.file_content,NEW.file_hash,NEW.created_at) IS DISTINCT FROM (OLD.group_id,OLD.uploaded_by,OLD.filename,OLD.file_content,OLD.file_hash,OLD.created_at) OR OLD.state='VOID' THEN RAISE EXCEPTION 'Import source is immutable'; END IF;
 IF NOT(NEW.state=OLD.state OR (OLD.state='PREVIEW' AND NEW.state='IMPORTED') OR (OLD.state='IMPORTED' AND NEW.state='VOID')) THEN RAISE EXCEPTION 'Invalid import transition'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER import_batch_guard BEFORE UPDATE ON family_import.batches FOR EACH ROW EXECUTE FUNCTION family_import.batch_guard();
CREATE FUNCTION family_import.row_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF (NEW.batch_id,NEW.sheet,NEW.row_number,NEW.data,NEW.errors,NEW.classification,NEW.duplicate_reasons) IS DISTINCT FROM (OLD.batch_id,OLD.sheet,OLD.row_number,OLD.data,OLD.errors,OLD.classification,OLD.duplicate_reasons) OR (SELECT state FROM family_import.batches WHERE id=OLD.batch_id)<>'PREVIEW' THEN RAISE EXCEPTION 'Import row is immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER import_row_guard BEFORE UPDATE ON family_import.rows FOR EACH ROW EXECUTE FUNCTION family_import.row_guard();
-- Track substantive activity at its data source, including existing workflows.
-- Status classification alone is intentionally not substantive activity.
CREATE FUNCTION family_import.track_activity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payload jsonb; ref uuid; record_state record; person uuid;
BEGIN
 payload=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_SCHEMA='family' AND TG_TABLE_NAME='families' THEN
  ref=(payload->>'id')::uuid;
  IF TG_OP='UPDATE' AND (to_jsonb(NEW)-ARRAY['status','version','updated_at'])=(to_jsonb(OLD)-ARRAY['status','version','updated_at']) THEN
   IF EXISTS(SELECT 1 FROM family_import.families i JOIN family_import.batches b ON b.id=i.batch_id WHERE i.family_id=ref AND b.state='VOID') AND NEW.status<>'CLOSED' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Voided family cannot reactivate'; END IF;
   RETURN NEW;
  END IF;
 ELSIF TG_TABLE_SCHEMA='identity' THEN
  person=(payload->>'id')::uuid;
  SELECT m.family_id INTO ref FROM family.family_memberships m JOIN family_import.families i ON i.family_id=m.family_id WHERE m.person_id=person AND m.valid_to IS NULL LIMIT 1;
 ELSIF payload ? 'membership_id' THEN
  SELECT family_id INTO ref FROM family.family_memberships WHERE id=(payload->>'membership_id')::uuid;
 ELSE ref=(payload->>'family_id')::uuid;
 END IF;
 IF ref IS NULL THEN RETURN COALESCE(NEW,OLD); END IF;
 SELECT i.*,b.state AS batch_state,f.status INTO record_state FROM family_import.families i JOIN family_import.batches b ON b.id=i.batch_id JOIN family.families f ON f.id=i.family_id WHERE i.family_id=ref FOR UPDATE OF i,f;
 IF NOT FOUND THEN RETURN COALESCE(NEW,OLD); END IF;
 IF record_state.batch_state='VOID' THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Import batch was voided'; END IF;
 IF TG_TABLE_SCHEMA='assessment' AND TG_TABLE_NAME IN ('domain_reviews','health_reviews','snapshots','drafts') AND (record_state.status<>'ACTIVE' OR record_state.members_confirmed_at IS NULL) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Confirm active family members before assessment'; END IF;
 UPDATE family_import.families SET activity_at=COALESCE(activity_at,now()),activity_source=COALESCE(activity_source,TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME) WHERE family_id=ref;
 RETURN COALESCE(NEW,OLD);
END $$;
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT table_schema,table_name FROM information_schema.columns WHERE column_name='family_id' AND table_schema IN ('family','assessment','monitoring','guidance','oversight') AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_type='BASE TABLE') LOOP
  EXECUTE format('CREATE TRIGGER import_activity BEFORE INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION family_import.track_activity()',t.table_schema,t.table_name);
 END LOOP;
END $$;
CREATE TRIGGER import_activity BEFORE UPDATE ON family.families FOR EACH ROW EXECUTE FUNCTION family_import.track_activity();
CREATE TRIGGER import_activity BEFORE UPDATE ON identity.people FOR EACH ROW EXECUTE FUNCTION family_import.track_activity();
CREATE TRIGGER import_activity BEFORE INSERT OR UPDATE ON assessment.health_screenings FOR EACH ROW EXECUTE FUNCTION family_import.track_activity();
CREATE TRIGGER import_activity BEFORE INSERT OR UPDATE ON assessment.health_forms FOR EACH ROW EXECUTE FUNCTION family_import.track_activity();
COMMIT;
