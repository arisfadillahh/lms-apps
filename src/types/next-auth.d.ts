import type { Role } from '@/types/supabase';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      username: string;
      fullName: string;
      role: Role;
      isActive: boolean;
    };
  }

  interface User {
    id: string;
    username: string;
    fullName: string;
    role: Role;
    isActive: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    userId: string;
    username: string;
    fullName: string;
    role: Role;
    isActive: boolean;
  }
}

export {};
