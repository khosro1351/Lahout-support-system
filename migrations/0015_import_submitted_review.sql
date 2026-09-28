BEGIN;
-- Preserve manager decisions on already submitted versions after family inactivation.
-- New drafts still require an active imported family with confirmed members.
CREATE OR REPLACE FUNCTION family_import.track_activity() RETURNS trigger LANGUAGE plpgsql AS $$
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
 IF TG_TABLE_SCHEMA='assessment' AND TG_TABLE_NAME IN ('domain_reviews','health_reviews','snapshots','drafts') AND (record_state.status<>'ACTIVE' OR record_state.members_confirmed_at IS NULL) AND NOT (TG_OP='UPDATE' AND TG_TABLE_NAME IN ('domain_reviews','health_reviews') AND to_jsonb(OLD)->>'state' IN ('SUBMITTED','IN_REVIEW') AND to_jsonb(NEW)->>'state' IN ('IN_REVIEW','RETURNED','APPROVED')) THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='Confirm active family members before assessment'; END IF;
 UPDATE family_import.families SET activity_at=COALESCE(activity_at,now()),activity_source=COALESCE(activity_source,TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME) WHERE family_id=ref;
 RETURN COALESCE(NEW,OLD);
END $$;
COMMIT;
