BEGIN;
CREATE SCHEMA assessment;
CREATE SCHEMA oversight;
ALTER TABLE identity.people ADD COLUMN birth_date date, ADD COLUMN sex text CHECK(sex IN ('FEMALE','MALE','UNKNOWN'));
CREATE TABLE assessment.models(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),version text NOT NULL UNIQUE,title text NOT NULL,
 state text NOT NULL CHECK(state IN ('DRAFT','APPROVED','ACTIVE','RETIRED')) DEFAULT 'DRAFT',
 definition jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),created_by uuid REFERENCES identity.accounts(id),activated_at timestamptz
);
CREATE UNIQUE INDEX one_active_scoring_model ON assessment.models(state) WHERE state='ACTIVE';
CREATE FUNCTION assessment.model_guard() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Scoring model history cannot be deleted'; END IF;
 IF OLD.state<>'DRAFT' AND (NEW.definition IS DISTINCT FROM OLD.definition OR NEW.version<>OLD.version OR NEW.title<>OLD.title) THEN RAISE EXCEPTION 'Published model is immutable'; END IF;
 IF NOT (NEW.state=OLD.state OR (OLD.state='DRAFT' AND NEW.state='APPROVED') OR (OLD.state='APPROVED' AND NEW.state='ACTIVE') OR (OLD.state='ACTIVE' AND NEW.state='RETIRED')) THEN RAISE EXCEPTION 'Invalid model transition'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER scoring_model_guard BEFORE UPDATE OR DELETE ON assessment.models FOR EACH ROW EXECUTE FUNCTION assessment.model_guard();
CREATE TABLE assessment.snapshots(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES family.families(id),model_id uuid NOT NULL REFERENCES assessment.models(id),
 revision integer NOT NULL,actor_id uuid NOT NULL REFERENCES identity.accounts(id),created_at timestamptz NOT NULL DEFAULT now(),
 answers jsonb NOT NULL,members jsonb NOT NULL,evidence jsonb NOT NULL DEFAULT '[]',result jsonb NOT NULL,
 state text NOT NULL CHECK(state IN ('PROVISIONAL','FINAL')),score numeric(14,8),level text CHECK(level IN ('A','B','C','D')),
 urgency text NOT NULL CHECK(urgency IN ('IMMEDIATE','NECESSARY','IMPORTANT','NON_URGENT')),
 UNIQUE(family_id,revision),CHECK((state='FINAL' AND score IS NOT NULL AND level IS NOT NULL) OR (state='PROVISIONAL' AND score IS NULL AND level IS NULL))
);
CREATE TRIGGER assessment_immutable BEFORE UPDATE OR DELETE ON assessment.snapshots FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TABLE oversight.alerts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),legacy_id uuid UNIQUE REFERENCES guidance.alerts(id),family_id uuid REFERENCES family.families(id),member_id uuid REFERENCES identity.people(id),person_id uuid REFERENCES identity.people(id),group_id uuid REFERENCES organization.groups(id),
 rule_code text NOT NULL,subject text NOT NULL,severity text NOT NULL CHECK(severity IN ('FOLLOW_UP','IMPORTANT','VERY_IMPORTANT','CRITICAL')),
 state text NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','ACKNOWLEDGED','IN_PROGRESS','RESOLVED')),
 owner_id uuid REFERENCES identity.accounts(id),escalated boolean NOT NULL DEFAULT false,trigger_detected boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),last_detected_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,resolved_by uuid REFERENCES identity.accounts(id),action_taken text,result text,evidence jsonb NOT NULL DEFAULT '[]',
 CHECK(state<>'RESOLVED' OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL AND length(trim(action_taken))>0 AND length(trim(result))>0))
);
CREATE UNIQUE INDEX operational_alert_dedup ON oversight.alerts(family_id,COALESCE(member_id,'00000000-0000-0000-0000-000000000000'::uuid),rule_code) WHERE family_id IS NOT NULL;
CREATE TRIGGER operational_alert_no_delete BEFORE DELETE ON oversight.alerts FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TABLE oversight.reminders(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),legacy_item_id uuid UNIQUE REFERENCES guidance.items(id),family_id uuid REFERENCES family.families(id),person_id uuid REFERENCES identity.people(id),group_id uuid REFERENCES organization.groups(id),
 subject text NOT NULL,owner_id uuid REFERENCES identity.accounts(id),due_at timestamptz,state text NOT NULL DEFAULT 'OPEN' CHECK(state IN ('OPEN','DONE')),
 created_at timestamptz NOT NULL DEFAULT now(),created_by uuid REFERENCES identity.accounts(id),completed_at timestamptz,result text
);
CREATE TRIGGER reminder_no_delete BEFORE DELETE ON oversight.reminders FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
INSERT INTO oversight.reminders(legacy_item_id,family_id,person_id,group_id,subject,due_at,created_at,created_by)
 SELECT id,family_id,person_id,group_id,subject,deadline,created_at,created_by FROM guidance.items WHERE note_type='REMINDER';
INSERT INTO oversight.alerts(id,legacy_id,family_id,person_id,group_id,rule_code,subject,severity,owner_id,escalated,created_at)
 SELECT a.id,a.id,i.family_id,i.person_id,i.group_id,'LEGACY_'||a.id,i.subject,CASE a.severity WHEN 'RED' THEN 'IMPORTANT' ELSE 'FOLLOW_UP' END,
 (SELECT r.account_id FROM identity.role_assignments r WHERE r.role_code='GROUP_LEADER' AND r.scope_id=COALESCE(i.group_id,f.current_group_id) AND r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now()) LIMIT 1),true,a.created_at
 FROM guidance.alerts a JOIN guidance.items i ON i.id=a.item_id LEFT JOIN family.families f ON f.id=i.family_id WHERE a.closed_at IS NULL AND i.note_type IS DISTINCT FROM 'REMINDER';
ALTER TABLE guidance.items ADD COLUMN archive_number bigint GENERATED BY DEFAULT AS IDENTITY,ADD COLUMN category text,ADD COLUMN related_people jsonb NOT NULL DEFAULT '[]',ADD COLUMN executor_id uuid REFERENCES identity.accounts(id),ADD COLUMN archive_final boolean NOT NULL DEFAULT false;
UPDATE guidance.items SET archive_final=true WHERE kind='COUNCIL';
CREATE INDEX council_archive_fts ON guidance.items USING gin(to_tsvector('simple',subject||' '||body)) WHERE kind='COUNCIL';
ALTER TABLE monitoring.support_records ADD COLUMN value_basis text NOT NULL DEFAULT 'ESTIMATED' CHECK(value_basis IN ('INVOICE','ESTIMATED'));
ALTER TABLE monitoring.stipends ADD COLUMN support_kind text NOT NULL DEFAULT 'STIPEND';
ALTER TABLE monitoring.distribution_plans ADD COLUMN status text NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','FINAL')),ADD COLUMN occasion text,ADD COLUMN result_summary text;
CREATE FUNCTION oversight.source_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE family_ref uuid; entity_ref uuid; payload jsonb; BEGIN
 payload=to_jsonb(NEW);family_ref=(payload->>'family_id')::uuid;entity_ref=COALESCE(family_ref,(payload->>'id')::uuid);
 INSERT INTO guidance.history(entity_type,entity_id,actor_id,action,new_state)
 VALUES(CASE WHEN family_ref IS NULL THEN 'ITEM' ELSE 'FAMILY' END,entity_ref,NULL,TG_ARGV[0],jsonb_build_object('source_id',payload->>'id','recorded_at',now(),'name',COALESCE(payload->>'name',payload->>'category',payload->>'subject')));
 INSERT INTO admin.audit_events(event_type,entity_type,entity_id,metadata) VALUES(TG_ARGV[0],CASE WHEN family_ref IS NULL THEN 'ITEM' ELSE 'FAMILY' END,entity_ref,jsonb_build_object('source_id',payload->>'id'));
 RETURN NEW; END $$;
CREATE TRIGGER research_source_history AFTER INSERT ON family.research_records FOR EACH ROW EXECUTE FUNCTION oversight.source_history('RESEARCH_RECORDED');
CREATE TRIGGER document_source_history AFTER INSERT ON family.documents FOR EACH ROW EXECUTE FUNCTION oversight.source_history('DOCUMENT_RECORDED');
CREATE TRIGGER support_source_history AFTER INSERT ON monitoring.support_records FOR EACH ROW EXECUTE FUNCTION oversight.source_history('SUPPORT_RECORDED');
CREATE TRIGGER council_source_history AFTER INSERT ON guidance.items FOR EACH ROW WHEN(NEW.kind='COUNCIL') EXECUTE FUNCTION oversight.source_history('COUNCIL_ARCHIVED');
-- Record the migration's observation of old sources, without inventing original actors/events.
INSERT INTO guidance.history(entity_type,entity_id,action,new_state)
 SELECT 'FAMILY',f.id,'EXISTING_RECORDS_INDEXED',jsonb_build_object('research',(SELECT count(*) FROM family.research_records r WHERE r.family_id=f.id),'documents',(SELECT count(*) FROM family.documents d WHERE d.family_id=f.id),'supports',(SELECT count(*) FROM monitoring.support_records s WHERE s.family_id=f.id)) FROM family.families f;
COMMIT;
