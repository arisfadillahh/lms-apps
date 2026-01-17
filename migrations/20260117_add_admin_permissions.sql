-- Add admin_permissions column to users table
ALTER TABLE users 
ADD COLUMN admin_permissions JSONB DEFAULT NULL;

COMMENT ON COLUMN users.admin_permissions IS 'Permissions for admin users. Structure: { menus: string[], is_superadmin: boolean }';
