BEGIN;
-- Add review tracking only to mutable drafts. Historical payloads are untouched.
ALTER TABLE assessment.drafts ADD COLUMN requires_full_review boolean NOT NULL DEFAULT false,
 ADD COLUMN reviewed_domains text[] NOT NULL DEFAULT '{}';
CREATE VIEW assessment.approved_family_results AS
 SELECT DISTINCT ON (s.family_id) s.*,d.created_at AS approved_at,m.version AS model_version
 FROM assessment.snapshots s JOIN assessment.decisions d ON d.snapshot_id=s.id AND d.decision='APPROVED'
 JOIN assessment.models m ON m.id=s.model_id AND m.definition->>'engine'='comprehensive-v2'
 ORDER BY s.family_id,s.revision DESC;
-- Keep the existing reporting schema and its dependent views, change only its source of assessment truth.
CREATE OR REPLACE VIEW monitoring.family_facts AS SELECT f.id AS family_id,f.family_code,f.current_group_id AS group_id,g.group_number,COALESCE(NULLIF(g.name,''),'گروه '||g.group_number) AS group_name,
 h.first_name||' '||h.last_name AS head_name,h.mobile,h.national_id,f.status AS case_status,f.neighborhood,f.created_at,
 (SELECT count(*)::int FROM family.family_memberships m WHERE m.family_id=f.id AND m.valid_to IS NULL) AS member_count,
 a.score::numeric AS score,a.level AS need_level,
 CASE WHEN EXISTS(SELECT 1 FROM oversight.alerts x WHERE x.family_id=f.id AND x.state<>'RESOLVED' AND x.severity='CRITICAL') THEN 'CRITICAL'
 WHEN EXISTS(SELECT 1 FROM oversight.alerts x WHERE x.family_id=f.id AND x.state<>'RESOLVED' AND x.severity='VERY_IMPORTANT') THEN 'HIGH' ELSE 'NORMAL' END AS urgency,
 CASE WHEN p.research_due_at<now() AND p.research_status<>'COMPLETED' THEN 'OVERDUE' ELSE p.research_status END AS research_status,
 p.last_research_at,p.research_due_at,p.review_required,p.support_status,p.special_case,
 COALESCE((SELECT jsonb_object_agg(k,jsonb_build_object('title',k,'label',k,'score',v)) FROM jsonb_each(a.result->'domainRawScores') x(k,v)),'{}'::jsonb) AS domains,
 p.updated_at AS profile_updated_at,
 (SELECT count(*)::int FROM oversight.alerts x WHERE x.family_id=f.id AND x.state<>'RESOLVED') AS open_alerts,
 (SELECT count(*)::int FROM monitoring.activities x WHERE x.family_id=f.id AND x.kind='VISIT') AS visits,
 (SELECT max(occurred_at) FROM monitoring.activities x WHERE x.family_id=f.id AND x.kind='VISIT') AS last_visit,
 (SELECT COALESCE(sum(amount),0) FROM monitoring.support_records s WHERE s.family_id=f.id AND s.status='COMPLETED') AS support_total
 FROM family.families f JOIN organization.groups g ON g.id=f.current_group_id LEFT JOIN family.case_profiles p ON p.family_id=f.id
 LEFT JOIN family.head_history hh ON hh.family_id=f.id AND hh.valid_to IS NULL LEFT JOIN identity.people h ON h.id=hh.person_id
 LEFT JOIN assessment.approved_family_results a ON a.family_id=f.id;
UPDATE assessment.models SET state='RETIRED' WHERE state='ACTIVE' AND version<>'2.0';
UPDATE assessment.models SET state='ACTIVE',activated_at=COALESCE(activated_at,now()) WHERE version='2.0' AND state='APPROVED';
COMMIT;
