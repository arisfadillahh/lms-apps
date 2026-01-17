import 'server-only';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/types/supabase';

let adminClient: SupabaseClient<Database> | null = null;
let anonServerClient: SupabaseClient<Database> | null = null;

function getBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL');
  }
  return url;
}

export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (!adminClient) {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
    }

    adminClient = createClient<Database>(getBaseUrl(), serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      global: {
        fetch: (url, options) => {
          return fetch(url, { ...options, cache: 'no-store' });
        },
      },
    });
  }

  return adminClient;
}

export function getSupabaseAnonServer(): SupabaseClient<Database> {
  if (!anonServerClient) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!anonKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }

    anonServerClient = createClient<Database>(getBaseUrl(), anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return anonServerClient;
}
