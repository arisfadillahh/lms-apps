"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Role, TablesInsert, TablesRow } from '@/types/supabase';

export type UserRecord = TablesRow<'users'>;
export type UserSummary = Pick<UserRecord, 'id' | 'username' | 'full_name' | 'role' | 'is_active' | 'created_at' | 'updated_at' | 'parent_contact_phone'>;

export type CreateUserInput = {
  username: string;
  passwordHash: string;
  role: Role;
  fullName: string;
  parentContactPhone?: string | null;
  isActive?: boolean;
};

export async function getUserById(id: string): Promise<UserRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user by id: ${error.message}`);
  }

  return data;
}

export async function getUserByUsername(username: string): Promise<UserRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch user by username: ${error.message}`);
  }

  return data;
}

export async function createUser(input: CreateUserInput): Promise<UserRecord> {
  const supabase = getSupabaseAdmin();
  const payload: TablesInsert<'users'> = {
    username: input.username,
    password_hash: input.passwordHash,
    role: input.role,
    full_name: input.fullName,
    parent_contact_phone: input.parentContactPhone ?? null,
    is_active: input.isActive ?? true,
  };

  const { data, error } = await supabase.from('users').insert(payload).select('*').single();

  if (error) {
    throw new Error(`Failed to create user: ${error.message}`);
  }

  return data;
}

export async function resetUserPassword(userId: string, newHash: string, roles: Role[] = ['CODER']): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', userId)
    .in('role', roles)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Failed to reset password: ${error.message}`);
  }
}

export async function setActive(userId: string, isActive: boolean): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('users').update({ is_active: isActive }).eq('id', userId);

  if (error) {
    throw new Error(`Failed to update user active state: ${error.message}`);
  }
}

export async function updateUser(userId: string, updates: Record<string, unknown>): Promise<void> {
  const supabase = getSupabaseAdmin();

  // Filter out undefined values
  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      payload[key] = value;
    }
  }

  if (Object.keys(payload).length === 0) return;

  const { error } = await supabase.from('users').update(payload).eq('id', userId);

  if (error) {
    throw new Error(`Failed to update user profile: ${error.message}`);
  }
}

export async function listUsers(): Promise<UserSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('id, username, full_name, role, is_active, created_at, updated_at, parent_contact_phone')
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  return (data ?? []) as UserSummary[];
}

export async function listUsersByRole(role: Role): Promise<UserRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('role', role)
    .order('full_name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list users by role: ${error.message}`);
  }

  return data ?? [];
}

export async function getUsersByIds(ids: string[]): Promise<UserRecord[]> {
  if (ids.length === 0) {
    return [];
  }
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .in('id', ids);

  if (error) {
    throw new Error(`Failed to fetch users by ids: ${error.message}`);
  }

  return data ?? [];
}

export async function deleteUser(userId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  const { error: authError } = await supabase.auth.admin.deleteUser(userId);

  if (authError) {
    console.error(`Failed to delete user from auth: ${authError.message}`);
  }

  const { error: dbError } = await supabase.from('users').delete().eq('id', userId);

  if (dbError) {
    throw new Error(`Failed to delete user record: ${dbError.message}`);
  }
}
