BEGIN;
CREATE SCHEMA IF NOT EXISTS monitoring;
CREATE TABLE monitoring.seed_batches(key text PRIMARY KEY,created_at timestamptz NOT NULL DEFAULT now());
CREATE SEQUENCE organization.group_number_seq START 1000;
ALTER TABLE organization.groups ADD COLUMN group_number bigint NOT NULL DEFAULT nextval('organization.group_number_seq');
ALTER TABLE organization.groups ADD CONSTRAINT groups_number_unique UNIQUE(group_number);
ALTER TABLE organization.groups ALTER COLUMN name SET DEFAULT '';
UPDATE identity.roles SET label_fa='همیار گروه' WHERE code='HELPER';
UPDATE identity.roles SET label_fa='عضو شورای کانون' WHERE code='COUNCIL_MEMBER';
ALTER TABLE identity.role_assignments ADD CONSTRAINT helper_group_scope CHECK(role_code<>'HELPER' OR scope_type='GROUP') NOT VALID;
ALTER TABLE guidance.items ADD COLUMN person_id uuid REFERENCES identity.people(id), ADD COLUMN family_id uuid REFERENCES family.families(id), ADD COLUMN group_id uuid REFERENCES organization.groups(id), ADD COLUMN note_type text;
ALTER TABLE guidance.items DROP CONSTRAINT items_kind_check;
ALTER TABLE guidance.items ADD CONSTRAINT items_kind_check CHECK(kind IN ('DECISION','PERMISSION','MISSION','URGENT','COUNCIL','COORDINATION','NOTE'));
ALTER TABLE guidance.items DROP CONSTRAINT items_review_state_check;
ALTER TABLE guidance.items ADD CONSTRAINT items_review_state_check CHECK(review_state IN ('PENDING','APPROVED','RECONSIDER','CANCELLED','REPLACED','STOPPED'));
ALTER TABLE guidance.items ADD COLUMN execution_status text NOT NULL DEFAULT 'NOT_STARTED' CHECK(execution_status IN ('NOT_STARTED','RUNNING','STOPPED','COMPLETED'));
ALTER TABLE guidance.alerts ADD COLUMN severity text NOT NULL DEFAULT 'RED' CHECK(severity IN ('RED','AMBER','INFO'));
ALTER TABLE guidance.notifications ADD COLUMN link_type text, ADD COLUMN link_id uuid;
CREATE TABLE guidance.permission_checks(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),person_id uuid NOT NULL REFERENCES identity.people(id),subject varchar(200) NOT NULL,explanation text NOT NULL,
 requested_by uuid NOT NULL REFERENCES identity.accounts(id),created_at timestamptz NOT NULL DEFAULT now(),seen_at timestamptz,
 decision text CHECK(decision IN ('APPROVED','NOT_APPROVED')),decided_by uuid REFERENCES identity.accounts(id),decided_at timestamptz,
 CHECK((decision IS NULL AND decided_by IS NULL AND decided_at IS NULL) OR (decision IS NOT NULL AND decided_by IS NOT NULL AND decided_at IS NOT NULL))
);
CREATE FUNCTION guidance.permission_final() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
 IF TG_OP='DELETE' OR OLD.decision IS NOT NULL THEN RAISE EXCEPTION 'Final permission is immutable'; END IF;
 IF (to_jsonb(NEW)-'seen_at'-'decision'-'decided_by'-'decided_at') IS DISTINCT FROM (to_jsonb(OLD)-'seen_at'-'decision'-'decided_by'-'decided_at') THEN RAISE EXCEPTION 'Request data is immutable'; END IF;
 RETURN NEW; END $$;
CREATE TRIGGER permission_final BEFORE UPDATE OR DELETE ON guidance.permission_checks FOR EACH ROW EXECUTE FUNCTION guidance.permission_final();
CREATE TABLE guidance.attachments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),item_id uuid NOT NULL REFERENCES guidance.items(id),name text NOT NULL,media_type text NOT NULL,content bytea NOT NULL);
CREATE TRIGGER attachment_no_delete BEFORE DELETE ON guidance.attachments FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
ALTER TABLE guidance.items ADD CONSTRAINT single_context CHECK(num_nonnulls(person_id,family_id,group_id)<=1);
CREATE TABLE family.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES family.families(id),name text NOT NULL,media_type text NOT NULL,content bytea NOT NULL);
CREATE TRIGGER document_no_delete BEFORE DELETE ON family.documents FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TABLE family.case_profiles(
 family_id uuid PRIMARY KEY REFERENCES family.families(id),score numeric,need_level text CHECK(need_level IN ('A','B','C','D')),
 urgency text NOT NULL DEFAULT 'NORMAL' CHECK(urgency IN ('NORMAL','HIGH','CRITICAL')),research_status text NOT NULL DEFAULT 'NOT_STARTED',
 last_research_at timestamptz,research_due_at timestamptz,review_required boolean NOT NULL DEFAULT false,support_status text NOT NULL DEFAULT 'NONE',
 special_case boolean NOT NULL DEFAULT false,domains jsonb NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now(),provenance text NOT NULL
);
CREATE TABLE family.research_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES family.families(id),actor_id uuid REFERENCES identity.accounts(id),source text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now(),due_at timestamptz,completed_at timestamptz,answers jsonb NOT NULL DEFAULT '{}',document_names jsonb NOT NULL DEFAULT '[]',provenance text NOT NULL);
CREATE TABLE monitoring.support_records(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES family.families(id),category text NOT NULL,amount numeric NOT NULL CHECK(amount>=0),status text NOT NULL,source text,result text,occurred_at timestamptz NOT NULL,actor_id uuid REFERENCES identity.accounts(id),provenance text NOT NULL);
CREATE TABLE monitoring.stipends(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid NOT NULL REFERENCES family.families(id),monthly_amount numeric NOT NULL CHECK(monthly_amount>=0),starts_on date NOT NULL,ends_on date,provenance text NOT NULL);
CREATE TABLE monitoring.stipend_payments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),stipend_id uuid NOT NULL REFERENCES monitoring.stipends(id),due_on date NOT NULL,amount numeric NOT NULL CHECK(amount>=0),paid_at timestamptz,UNIQUE(stipend_id,due_on));
CREATE TABLE monitoring.distribution_plans(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),title text NOT NULL,category text NOT NULL,capacity integer NOT NULL CHECK(capacity>=0),unit_value numeric NOT NULL CHECK(unit_value>=0),source text,planned_on date NOT NULL,provenance text NOT NULL);
CREATE TABLE monitoring.distribution_recipients(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),plan_id uuid NOT NULL REFERENCES monitoring.distribution_plans(id),family_id uuid NOT NULL REFERENCES family.families(id),status text NOT NULL CHECK(status IN ('TARGET','ELIGIBLE','FINAL','RESERVE','NON_DELIVERY','REPLACEMENT')),UNIQUE(plan_id,family_id));
CREATE TABLE monitoring.activities(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),family_id uuid REFERENCES family.families(id),account_id uuid NOT NULL REFERENCES identity.accounts(id),kind text NOT NULL,occurred_at timestamptz NOT NULL,due_at timestamptz,completed_at timestamptz,result text,provenance text NOT NULL);
CREATE TRIGGER research_no_delete BEFORE DELETE ON family.research_records FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER support_no_delete BEFORE DELETE ON monitoring.support_records FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER stipend_no_delete BEFORE DELETE ON monitoring.stipends FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER payment_no_delete BEFORE DELETE ON monitoring.stipend_payments FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER distribution_no_delete BEFORE DELETE ON monitoring.distribution_plans FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER recipient_no_delete BEFORE DELETE ON monitoring.distribution_recipients FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER profile_no_delete BEFORE DELETE ON family.case_profiles FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE TRIGGER activity_no_delete BEFORE DELETE ON monitoring.activities FOR EACH ROW EXECUTE FUNCTION guidance.no_delete();
CREATE VIEW monitoring.family_facts AS SELECT f.id AS family_id,f.family_code,f.current_group_id AS group_id,g.group_number,COALESCE(NULLIF(g.name,''),'گروه '||g.group_number) AS group_name,
 h.first_name||' '||h.last_name AS head_name,h.mobile,h.national_id,f.status AS case_status,f.neighborhood,f.created_at,
 (SELECT count(*)::int FROM family.family_memberships m WHERE m.family_id=f.id AND m.valid_to IS NULL) AS member_count,
 p.score,p.need_level,p.urgency,CASE WHEN p.research_due_at<now() AND p.research_status<>'COMPLETED' THEN 'OVERDUE' ELSE p.research_status END AS research_status,
 p.last_research_at,p.research_due_at,p.review_required,p.support_status,p.special_case,p.domains,p.updated_at AS profile_updated_at,
 (SELECT count(*)::int FROM guidance.alerts a JOIN guidance.items i ON i.id=a.item_id WHERE i.family_id=f.id AND a.closed_at IS NULL) AS open_alerts,
 (SELECT count(*)::int FROM monitoring.activities a WHERE a.family_id=f.id AND a.kind='VISIT') AS visits,
 (SELECT max(occurred_at) FROM monitoring.activities a WHERE a.family_id=f.id AND a.kind='VISIT') AS last_visit,
 (SELECT COALESCE(sum(amount),0) FROM monitoring.support_records s WHERE s.family_id=f.id AND s.status='COMPLETED') AS support_total
 FROM family.families f JOIN organization.groups g ON g.id=f.current_group_id LEFT JOIN family.case_profiles p ON p.family_id=f.id
 LEFT JOIN family.head_history hh ON hh.family_id=f.id AND hh.valid_to IS NULL LEFT JOIN identity.people h ON h.id=hh.person_id;
CREATE VIEW monitoring.support_facts AS SELECT s.id,s.family_id,f.family_code,f.group_id,f.group_name,f.head_name,s.category AS support_type,s.amount,s.status,s.source,s.result,s.occurred_at AS created_at,s.actor_id,s.provenance FROM monitoring.support_records s JOIN monitoring.family_facts f ON f.family_id=s.family_id;
CREATE VIEW monitoring.stipend_facts AS SELECT s.id,s.family_id,f.family_code,f.group_id,f.group_name,f.head_name,s.monthly_amount,s.starts_on,s.ends_on,s.starts_on::timestamptz AS created_at,
 (SELECT count(*)::int FROM monitoring.stipend_payments p WHERE p.stipend_id=s.id AND p.paid_at IS NOT NULL) AS paid_count,
 (SELECT COALESCE(sum(amount),0) FROM monitoring.stipend_payments p WHERE p.stipend_id=s.id AND p.paid_at IS NOT NULL) AS paid_total,
 (SELECT COALESCE(sum(amount),0) FROM monitoring.stipend_payments p WHERE p.stipend_id=s.id AND p.paid_at IS NULL AND p.due_on<current_date) AS overdue_amount,
 (SELECT jsonb_agg(jsonb_build_object('due_on',p.due_on,'amount',p.amount,'paid_at',p.paid_at) ORDER BY due_on) FROM monitoring.stipend_payments p WHERE p.stipend_id=s.id) AS payments,s.provenance FROM monitoring.stipends s JOIN monitoring.family_facts f ON f.family_id=s.family_id;
CREATE VIEW monitoring.distribution_facts AS SELECT p.id AS plan_id,p.title,p.category AS plan_type,p.capacity,p.unit_value,p.source,p.planned_on::timestamptz AS created_at,
 r.family_id,f.family_code,f.group_id,f.group_name,r.status,
 (SELECT count(*)::int FROM monitoring.distribution_recipients x WHERE x.plan_id=p.id) AS target_families,
 (SELECT count(*)::int FROM monitoring.distribution_recipients x WHERE x.plan_id=p.id AND x.status='ELIGIBLE') AS eligible,
 (SELECT count(*)::int FROM monitoring.distribution_recipients x WHERE x.plan_id=p.id AND x.status='FINAL') AS final_recipients,
 (SELECT count(*)::int FROM monitoring.distribution_recipients x WHERE x.plan_id=p.id AND x.status='RESERVE') AS reserve,
 (SELECT count(*)::int FROM monitoring.distribution_recipients x WHERE x.plan_id=p.id AND x.status='NON_DELIVERY') AS non_delivery,
 (SELECT count(*)::int FROM monitoring.distribution_recipients x WHERE x.plan_id=p.id AND x.status='REPLACEMENT') AS replacement,p.provenance
 FROM monitoring.distribution_plans p LEFT JOIN monitoring.distribution_recipients r ON r.plan_id=p.id LEFT JOIN monitoring.family_facts f ON f.family_id=r.family_id;
CREATE VIEW monitoring.group_facts AS SELECT g.id AS group_id,g.group_number,COALESCE(NULLIF(g.name,''),'گروه '||g.group_number) AS group_name,g.status,g.created_at,
 (SELECT count(*)::int FROM monitoring.family_facts f WHERE f.group_id=g.id) AS family_count,
 (SELECT count(*)::int FROM monitoring.family_facts f WHERE f.group_id=g.id AND f.need_level='A') AS level_a,
 (SELECT count(*)::int FROM monitoring.family_facts f WHERE f.group_id=g.id AND f.need_level='B') AS level_b,
 (SELECT count(*)::int FROM monitoring.family_facts f WHERE f.group_id=g.id AND f.need_level='C') AS level_c,
 (SELECT count(*)::int FROM monitoring.family_facts f WHERE f.group_id=g.id AND f.need_level='D') AS level_d,
 (SELECT avg(score) FROM monitoring.family_facts f WHERE f.group_id=g.id) AS avg_need_score,
 (SELECT count(*)::int FROM monitoring.family_facts f WHERE f.group_id=g.id AND f.research_status='OVERDUE') AS overdue_research,
 (SELECT count(*)::int FROM monitoring.family_facts f WHERE f.group_id=g.id AND f.review_required) AS review_required,
 (SELECT count(*)::int FROM monitoring.family_facts f WHERE f.group_id=g.id AND f.special_case) AS special_cases,
 (SELECT avg(CASE WHEN last_research_at IS NOT NULL AND research_status='COMPLETED' AND NOT review_required THEN 100.0 ELSE 0 END) FROM monitoring.family_facts f WHERE f.group_id=g.id) AS up_to_date_pct,
 (SELECT count(*)::int FROM guidance.alerts a JOIN guidance.items i ON i.id=a.item_id LEFT JOIN family.families f ON f.id=i.family_id WHERE a.closed_at IS NULL AND (i.group_id=g.id OR f.current_group_id=g.id)) AS open_alerts,
 (SELECT avg(extract(epoch FROM(a.closed_at-a.created_at))/3600) FROM guidance.alerts a JOIN guidance.items i ON i.id=a.item_id LEFT JOIN family.families f ON f.id=i.family_id WHERE a.closed_at IS NOT NULL AND (i.group_id=g.id OR f.current_group_id=g.id)) AS avg_response_hours
 FROM organization.groups g;
CREATE VIEW monitoring.performance_facts AS
WITH scope AS (SELECT DISTINCT r.account_id,f.family_id FROM identity.role_assignments r JOIN monitoring.family_facts f ON r.scope_id=f.group_id OR (r.role_code='EXECUTIVE_MANAGER' AND r.scope_type='ORGANIZATION') WHERE r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now())),
 base AS (SELECT a.id AS account_id,p.id AS person_id,p.first_name||' '||p.last_name AS person_name,p.mobile,a.status,a.created_at,
 (SELECT string_agg(r.role_code,',') FROM identity.role_assignments r WHERE r.account_id=a.id AND r.valid_from<=now() AND (r.valid_to IS NULL OR r.valid_to>now())) AS role_codes,
 (SELECT count(*)::int FROM scope s WHERE s.account_id=a.id) AS family_count,
 (SELECT count(*)::int FROM scope s JOIN monitoring.family_facts f ON f.family_id=s.family_id WHERE s.account_id=a.id AND f.need_level IN ('A','B')) AS high_need_families,
 (SELECT count(*)::int FROM scope s JOIN monitoring.family_facts f ON f.family_id=s.family_id WHERE s.account_id=a.id AND f.special_case) AS special_cases,
 (SELECT count(*)::int FROM monitoring.activities x WHERE x.account_id=a.id AND x.kind='VISIT') AS visits,
 (SELECT extract(epoch FROM(max(x.occurred_at)-min(x.occurred_at)))/86400/nullif(count(*)-1,0) FROM monitoring.activities x WHERE x.account_id=a.id AND x.kind='VISIT') AS avg_visit_gap_days,
 (SELECT count(*)::int FROM monitoring.activities x WHERE x.account_id=a.id AND x.kind='RESEARCH' AND x.completed_at IS NOT NULL) AS completed_research,
 (SELECT count(*)::int FROM monitoring.activities x WHERE x.account_id=a.id AND x.completed_at IS NULL AND x.due_at<now()) AS overdue_actions,
 (SELECT avg(CASE WHEN x.completed_at<=x.due_at THEN 100.0 ELSE 0 END) FROM monitoring.activities x WHERE x.account_id=a.id AND x.due_at IS NOT NULL AND (x.completed_at IS NOT NULL OR x.due_at<now())) AS timeliness_pct,
 (SELECT avg(CASE WHEN x.completed_at IS NOT NULL THEN 100.0 ELSE 0 END) FROM monitoring.activities x WHERE x.account_id=a.id) AS completion_pct,
 (SELECT avg(CASE WHEN x.completed_at IS NOT NULL AND length(trim(COALESCE(x.result,'')))>0 THEN 100.0 ELSE 0 END) FROM monitoring.activities x WHERE x.account_id=a.id) AS documented_followup_pct,
 (SELECT avg(CASE WHEN f.last_research_at IS NOT NULL AND f.research_status='COMPLETED' AND NOT f.review_required THEN 100.0 ELSE 0 END) FROM scope s JOIN monitoring.family_facts f ON f.family_id=s.family_id WHERE s.account_id=a.id) AS freshness_pct,
 (SELECT avg(CASE WHEN al.closed_at IS NOT NULL THEN 100.0 ELSE 0 END) FROM guidance.alerts al JOIN guidance.items i ON i.id=al.item_id WHERE i.family_id IN(SELECT family_id FROM scope WHERE account_id=a.id) OR i.person_id=p.id) AS alert_resolution_pct,
 (SELECT count(*)::int FROM guidance.alerts al JOIN guidance.items i ON i.id=al.item_id WHERE al.closed_at IS NULL AND (i.family_id IN(SELECT family_id FROM scope WHERE account_id=a.id) OR i.person_id=p.id)) AS open_alerts,
 (SELECT avg(extract(epoch FROM(x.completed_at-x.occurred_at))/3600) FROM monitoring.activities x WHERE x.account_id=a.id AND x.completed_at IS NOT NULL) AS avg_response_hours,
 (SELECT count(*)::int FROM scope s JOIN monitoring.family_facts f ON f.family_id=s.family_id WHERE s.account_id=a.id AND f.review_required) AS reviews_required,
 (SELECT count(*)::int FROM scope s JOIN monitoring.family_facts f ON f.family_id=s.family_id WHERE s.account_id=a.id AND f.research_status='OVERDUE') AS overdue_research,
 (SELECT count(*)::int FROM guidance.alerts al JOIN guidance.items i ON i.id=al.item_id WHERE al.severity='RED' AND al.closed_at IS NULL AND (i.family_id IN(SELECT family_id FROM scope WHERE account_id=a.id) OR i.person_id=p.id)) AS red_alerts,
 (SELECT avg(extract(epoch FROM(al.closed_at-al.created_at))/3600) FROM guidance.alerts al JOIN guidance.items i ON i.id=al.item_id WHERE al.closed_at IS NOT NULL AND (i.family_id IN(SELECT family_id FROM scope WHERE account_id=a.id) OR i.person_id=p.id)) AS alert_resolution_hours,
 (SELECT count(*)::int FROM guidance.items i WHERE i.kind='COUNCIL' AND i.execution_status='COMPLETED' AND (i.created_by=a.id OR EXISTS(SELECT 1 FROM guidance.recipients r WHERE r.item_id=i.id AND r.account_id=a.id))) AS council_executed,
 (SELECT count(*)::int FROM guidance.permission_checks v WHERE v.requested_by=a.id) AS verification_requests,
 (SELECT count(*)::int FROM guidance.permission_checks v WHERE v.requested_by=a.id AND v.decision IS NOT NULL) AS verification_completed,
 (SELECT count(*)::int FROM monitoring.support_records x WHERE x.actor_id=a.id AND x.status='COMPLETED') AS completed_supports
 FROM identity.accounts a JOIN identity.people p ON p.id=a.person_id)
 SELECT base.*,(SELECT avg(v) FROM (VALUES(timeliness_pct),(completion_pct),(documented_followup_pct),(freshness_pct),(alert_resolution_pct)) AS dimensions(v)) AS performance_pct FROM base;
COMMIT;
