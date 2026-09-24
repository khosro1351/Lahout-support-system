BEGIN;
-- A person has one account; fail rather than merge any unexpected duplicates.
CREATE UNIQUE INDEX accounts_person_unique ON identity.accounts(person_id);
UPDATE identity.roles SET label_fa=CASE code WHEN 'SUPREME_GUIDE' THEN 'همیار شاهد' WHEN 'TECH_ADMIN' THEN 'پشتیبان فنی سامانه' WHEN 'HELPER' THEN 'همیار گروه' WHEN 'COUNCIL_MEMBER' THEN 'عضو شورای کانون' ELSE label_fa END;
ALTER TABLE identity.auth_sessions ADD COLUMN selected_role varchar(50) REFERENCES identity.roles(code), ADD COLUMN simulation_role varchar(50) REFERENCES identity.roles(code), ADD COLUMN simulation_group_id uuid REFERENCES organization.groups(id);
ALTER TABLE identity.auth_sessions ADD CONSTRAINT session_simulation_context CHECK ((simulation_role IS NULL AND simulation_group_id IS NULL) OR (selected_role='TECH_ADMIN' AND simulation_role<>'TECH_ADMIN' AND ((simulation_role IN ('GROUP_LEADER','HELPER') AND simulation_group_id IS NOT NULL) OR (simulation_role NOT IN ('GROUP_LEADER','HELPER') AND simulation_group_id IS NULL))));
UPDATE identity.auth_sessions s SET selected_role=x.role_code FROM (SELECT account_id,min(role_code) role_code FROM identity.role_assignments WHERE valid_from<=now() AND (valid_to IS NULL OR valid_to>now()) GROUP BY account_id HAVING count(DISTINCT role_code)=1) x WHERE x.account_id=s.account_id;
ALTER TABLE admin.audit_events ADD COLUMN effective_role varchar(50), ADD COLUMN effective_scopes jsonb, ADD COLUMN simulation boolean NOT NULL DEFAULT false;
ALTER TABLE guidance.history ADD COLUMN effective_role varchar(50), ADD COLUMN effective_scopes jsonb, ADD COLUMN simulation boolean NOT NULL DEFAULT false;
COMMIT;
