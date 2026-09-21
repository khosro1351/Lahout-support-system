BEGIN;
-- Additive read context: no legacy record, assessment, role or workflow is changed.
CREATE TABLE family.investigation_context (
 research_id uuid PRIMARY KEY REFERENCES family.research_records(id),
 subject text NOT NULL, referral_reason text,
 council_item_id uuid REFERENCES guidance.items(id),
 board_snapshot jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(board_snapshot)='array'),
 findings text, final_result text, recorded_at timestamptz NOT NULL DEFAULT now(),
 actor_id uuid REFERENCES identity.accounts(id)
);
CREATE TABLE family.investigation_visits (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),research_id uuid NOT NULL REFERENCES family.research_records(id),
 visited_at timestamptz NOT NULL,location text,summary text NOT NULL,
 actor_id uuid REFERENCES identity.accounts(id),recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE family.document_context (
 document_id uuid PRIMARY KEY REFERENCES family.documents(id),
 person_id uuid REFERENCES identity.people(id),research_id uuid REFERENCES family.research_records(id),
 support_id uuid REFERENCES monitoring.support_records(id),
 category text,valid_until date,recorded_at timestamptz NOT NULL DEFAULT now(),actor_id uuid REFERENCES identity.accounts(id),
 CHECK(num_nonnulls(person_id,research_id,support_id)<=1)
);
CREATE TABLE family.case_notes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES family.families(id),
 person_id uuid REFERENCES identity.people(id),research_id uuid REFERENCES family.research_records(id),support_id uuid REFERENCES monitoring.support_records(id),
 body text NOT NULL CHECK(length(trim(body))>0),actor_id uuid NOT NULL REFERENCES identity.accounts(id),recorded_at timestamptz NOT NULL DEFAULT now(),
 CHECK(num_nonnulls(person_id,research_id,support_id)<=1)
);
CREATE TRIGGER investigation_context_immutable BEFORE UPDATE OR DELETE ON family.investigation_context FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TRIGGER investigation_visit_immutable BEFORE UPDATE OR DELETE ON family.investigation_visits FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TRIGGER document_context_immutable BEFORE UPDATE OR DELETE ON family.document_context FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TRIGGER case_note_immutable BEFORE UPDATE OR DELETE ON family.case_notes FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE INDEX investigation_visits_research ON family.investigation_visits(research_id,visited_at);
CREATE INDEX case_notes_family ON family.case_notes(family_id,recorded_at);
CREATE TABLE family.support_context (
 support_id uuid PRIMARY KEY REFERENCES monitoring.support_records(id),person_id uuid REFERENCES identity.people(id),
 title text,need_domain text CHECK(need_domain IN ('livelihood','health','housing','vulnerability','education')),
 rationale text,expected_result text,recorded_at timestamptz NOT NULL DEFAULT now(),actor_id uuid REFERENCES identity.accounts(id)
);
CREATE TRIGGER support_context_immutable BEFORE UPDATE OR DELETE ON family.support_context FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE FUNCTION family.validate_read_context() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE family_ref uuid; target_family uuid;
BEGIN
 IF TG_TABLE_NAME='document_context' THEN SELECT family_id INTO family_ref FROM family.documents WHERE id=NEW.document_id;
 ELSIF TG_TABLE_NAME='support_context' THEN SELECT family_id INTO family_ref FROM monitoring.support_records WHERE id=NEW.support_id;
 ELSE family_ref=NEW.family_id; END IF;
 IF NEW.person_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM family.family_memberships WHERE family_id=family_ref AND person_id=NEW.person_id) THEN RAISE EXCEPTION 'Member context outside family'; END IF;
 IF TG_TABLE_NAME<>'support_context' THEN
  IF NEW.research_id IS NOT NULL THEN SELECT family_id INTO target_family FROM family.research_records WHERE id=NEW.research_id; IF target_family IS DISTINCT FROM family_ref THEN RAISE EXCEPTION 'Investigation context outside family'; END IF; END IF;
  IF NEW.support_id IS NOT NULL THEN SELECT family_id INTO target_family FROM monitoring.support_records WHERE id=NEW.support_id; IF target_family IS DISTINCT FROM family_ref THEN RAISE EXCEPTION 'Support context outside family'; END IF; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER document_context_scope BEFORE INSERT ON family.document_context FOR EACH ROW EXECUTE FUNCTION family.validate_read_context();
CREATE TRIGGER support_context_scope BEFORE INSERT ON family.support_context FOR EACH ROW EXECUTE FUNCTION family.validate_read_context();
CREATE TRIGGER case_note_scope BEFORE INSERT ON family.case_notes FOR EACH ROW EXECUTE FUNCTION family.validate_read_context();
CREATE FUNCTION family.read_context_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE payload jsonb=to_jsonb(NEW); family_ref uuid;
BEGIN
 IF TG_TABLE_NAME IN ('investigation_context','investigation_visits') THEN SELECT family_id INTO family_ref FROM family.research_records WHERE id=(payload->>'research_id')::uuid;
 ELSIF TG_TABLE_NAME='document_context' THEN SELECT family_id INTO family_ref FROM family.documents WHERE id=(payload->>'document_id')::uuid;
 ELSIF TG_TABLE_NAME='support_context' THEN SELECT family_id INTO family_ref FROM monitoring.support_records WHERE id=(payload->>'support_id')::uuid;
 ELSE family_ref=(payload->>'family_id')::uuid; END IF;
 INSERT INTO guidance.history(entity_type,entity_id,actor_id,action,new_state) VALUES('FAMILY',family_ref,(payload->>'actor_id')::uuid,TG_ARGV[0],payload);
 INSERT INTO admin.audit_events(event_type,entity_type,entity_id,metadata) VALUES(TG_ARGV[0],'FAMILY',family_ref,jsonb_build_object('source_id',COALESCE(payload->>'id',payload->>'research_id',payload->>'document_id',payload->>'support_id')));
 RETURN NEW;
END $$;
CREATE TRIGGER investigation_context_history AFTER INSERT ON family.investigation_context FOR EACH ROW EXECUTE FUNCTION family.read_context_history('RESEARCH_CONTEXT_RECORDED');
CREATE TRIGGER investigation_visit_history AFTER INSERT ON family.investigation_visits FOR EACH ROW EXECUTE FUNCTION family.read_context_history('RESEARCH_VISIT_RECORDED');
CREATE TRIGGER document_context_history AFTER INSERT ON family.document_context FOR EACH ROW EXECUTE FUNCTION family.read_context_history('DOCUMENT_CONTEXT_RECORDED');
CREATE TRIGGER support_context_history AFTER INSERT ON family.support_context FOR EACH ROW EXECUTE FUNCTION family.read_context_history('SUPPORT_CONTEXT_RECORDED');
CREATE TRIGGER case_note_history AFTER INSERT ON family.case_notes FOR EACH ROW EXECUTE FUNCTION family.read_context_history('CASE_NOTE_RECORDED');
COMMIT;
