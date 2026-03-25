
-- 1. Delete orphan permission rows (all CRUD flags are false = no actual access)
DELETE FROM role_module_permissions
WHERE NOT can_read AND NOT can_create AND NOT can_update AND NOT can_delete;

-- 2. Delete any role_module_permissions for unused roles
DELETE FROM role_module_permissions WHERE role IN ('user', 'donor', 'affiliate');

-- 3. Delete any role_templates for unused roles
DELETE FROM role_templates WHERE role_key IN ('user', 'donor', 'affiliate');

-- 4. Add a comment documenting active roles for clarity
COMMENT ON TYPE app_role IS 'Active roles: admin, moderator, founder, it, support, manager, marketing, finance, warehouse. Deprecated (unused): user, donor, affiliate.';
