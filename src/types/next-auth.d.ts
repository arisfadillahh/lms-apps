import type { Role } from '@/types/supabase';

type AdminPermissions = { menus: string[]; is_superadmin: boolean } | null;

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      fullName: string;
      role: Role;
      isActive: boolean;
      adminPermissions?: AdminPermissions;
    };
  }

  interface User {
    id: string;
    username: string;
    fullName: string;
    role: Role;
    isActive: boolean;
    adminPermissions?: AdminPermissions;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    username: string;
    fullName: string;
    role: Role;
    isActive: boolean;
    adminPermissions?: AdminPermissions;
  }
}

export { };
