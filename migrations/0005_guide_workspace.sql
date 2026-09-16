BEGIN;
CREATE SCHEMA IF NOT EXISTS guidance;
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE identity.role_assignments ADD CONSTRAINT one_guide_at_a_time EXCLUDE USING gist
 (role_code WITH =, tstzrange(valid_from,valid_to,'[)') WITH &&) WHERE (role_code='SUPREME_GUIDE');
ALTER TABLE identity.role_assignments ADD CONSTRAINT one_group_leader_at_a_time EXCLUDE USING gist
 (scope_id WITH =, tstzrange(valid_from,valid_to,'[)') WITH &&) WHERE (role_code='GROUP_LEADER' AND scope_type='GROUP');
ALTER TABLE identity.role_assignments ADD CONSTRAINT leadership_scope CHECK ((role_code<>'SUPREME_GUIDE' OR scope_type='ORGANIZATION') AND (role_code<>'GROUP_LEADER' OR scope_type='GROUP'));
CREATE TABLE guidance.history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL, entity_id uuid NOT NULL,
 actor_id uuid REFERENCES identity.accounts(id), action text NOT NULL, previous_state jsonb,
 new_state jsonb, reason text, occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guide_history_entity ON guidance.history(entity_type,entity_id,occurred_at);
CREATE FUNCTION guidance.immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 RAISE EXCEPTION 'History is immutable'; END $$;
CREATE TRIGGER guide_history_immutable BEFORE UPDATE OR DELETE ON guidance.history FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON admin.audit_events FOR EACH ROW EXECUTE FUNCTION guidance.immutable();
CREATE FUNCTION guidance.no_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Hard delete forbidden'; END $$;
CREATE TRIGGER role_no_delete BEFORE DELETE ON identity.role_assignments FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER group_no_delete BEFORE DELETE ON organization.groups FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TABLE guidance.items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('DECISION','PERMISSION','MISSION','URGENT','COUNCIL','COORDINATION')),
 subject varchar(200) NOT NULL CHECK(length(trim(subject))>0), body text NOT NULL DEFAULT '',
 created_by uuid NOT NULL REFERENCES identity.accounts(id), created_at timestamptz NOT NULL DEFAULT now(),
 deadline timestamptz, confidential boolean NOT NULL DEFAULT false,
 audience_type text NOT NULL CHECK(audience_type IN ('PEOPLE','ROLE','GROUP','ALL','GUIDE')),
 audience_spec jsonb NOT NULL DEFAULT '[]', lifecycle text NOT NULL DEFAULT 'ACTIVE' CHECK(lifecycle IN ('ACTIVE','CANCELLED','REPLACED')),
 review_state text NOT NULL DEFAULT 'PENDING' CHECK(review_state IN ('PENDING','APPROVED','RECONSIDER','CANCELLED','REPLACED')),
 supersedes uuid REFERENCES guidance.items(id), follow_up_for uuid REFERENCES guidance.items(id), discuss_in_council boolean NOT NULL DEFAULT false,
 completed_at timestamptz, result text, version integer NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX one_replacement ON guidance.items(supersedes) WHERE supersedes IS NOT NULL;
CREATE TABLE guidance.recipients (
 item_id uuid NOT NULL REFERENCES guidance.items(id), account_id uuid NOT NULL REFERENCES identity.accounts(id),
 seen_at timestamptz, completed_at timestamptz, result text,
 PRIMARY KEY(item_id,account_id)
);
CREATE TABLE guidance.notifications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), recipient_id uuid NOT NULL REFERENCES identity.accounts(id),
 item_id uuid REFERENCES guidance.items(id), category text NOT NULL, message text NOT NULL,
 visibility text NOT NULL CHECK(visibility IN ('PUBLIC','PRIVATE')), created_at timestamptz NOT NULL DEFAULT now(), seen_at timestamptz,
 dedupe_key text NOT NULL, UNIQUE(recipient_id,dedupe_key)
);
CREATE TABLE guidance.alerts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), item_id uuid NOT NULL REFERENCES guidance.items(id),
 category text NOT NULL CHECK(category IN ('IMPORTANT','OVERDUE')), created_at timestamptz NOT NULL DEFAULT now(),
 closed_at timestamptz, UNIQUE(item_id,category)
);
CREATE TRIGGER item_no_delete BEFORE DELETE ON guidance.items FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER recipient_no_delete BEFORE DELETE ON guidance.recipients FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER notification_no_delete BEFORE DELETE ON guidance.notifications FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER alert_no_delete BEFORE DELETE ON guidance.alerts FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE INDEX items_deadline ON guidance.items(deadline) WHERE completed_at IS NULL AND lifecycle='ACTIVE';
CREATE INDEX recipients_account ON guidance.recipients(account_id,item_id);
CREATE INDEX notifications_account ON guidance.notifications(recipient_id,created_at);
CREATE FUNCTION guidance.active_group_only() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM organization.groups WHERE id=NEW.current_group_id AND status='ACTIVE') THEN
 RAISE EXCEPTION 'New activity requires an active group' USING ERRCODE='23514'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER family_active_group BEFORE INSERT OR UPDATE OF current_group_id ON family.families FOR EACH ROW EXECUTE FUNCTION guidance.active_group_only();
COMMIT;
