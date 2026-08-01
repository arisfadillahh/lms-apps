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
  adminPermissions?: { menus: string[]; is_superadmin: boolean } | null;
};

const TRANSIENT_SCHEMA_CACHE_PATTERNS = [
  'schema cache',
  'retrying',
  'fetch failed',
];

function isTransientUserQueryError(error: { message?: string } | null): boolean {
  const message = error?.message?.toLowerCase() ?? '';
  return TRANSIENT_SCHEMA_CACHE_PATTERNS.some((pattern) => message.includes(pattern));
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  const supabase = getSupabaseAdmin();
  let lastError: { message: string } | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await supabase.from('users').select('*').eq('id', id).maybeSingle();

    if (!error) {
      return data;
    }

    lastError = error;

    if (!isTransientUserQueryError(error) || attempt === 2) {
      break;
    }

    await wait(150 * (attempt + 1));
  }

  throw new Error(`Failed to fetch user by id: ${lastError?.message ?? 'Unknown error'}`);
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
    admin_permissions: input.adminPermissions ?? null,
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
    .select('id, username, full_name, role, is_active, created_at, updated_at, parent_contact_phone, admin_permissions')
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

  // Preserve billing history while removing the hard FK to the deleted user.
  const { error: invoiceItemsError } = await supabase
    .from('invoice_items' as any)
    .update({ coder_id: null })
    .eq('coder_id', userId);
  if (invoiceItemsError) {
    throw new Error(`Failed to detach invoice items: ${invoiceItemsError.message}`);
  }

  const { error: paymentPeriodsError } = await supabase
    .from('coder_payment_periods' as any)
    .update({ coder_id: null, status: 'EXPIRED' })
    .eq('coder_id', userId);
  if (paymentPeriodsError) {
    throw new Error(`Failed to detach payment periods: ${paymentPeriodsError.message}`);
  }

  // Delete related learning/access records first to avoid FK constraint errors.
  const { error: enrollmentError } = await supabase.from('enrollments').delete().eq('coder_id', userId);
  if (enrollmentError) {
    throw new Error(`Failed to delete enrollments: ${enrollmentError.message}`);
  }

  const { error: attendanceError } = await supabase.from('attendance').delete().eq('coder_id', userId);
  if (attendanceError) {
    throw new Error(`Failed to delete attendance records: ${attendanceError.message}`);
  }

  const { error: blockCompletionsError } = await supabase
    .from('coder_block_completions' as any)
    .delete()
    .eq('coder_id', userId);
  if (blockCompletionsError) {
    throw new Error(`Failed to delete block completions: ${blockCompletionsError.message}`);
  }

  const { error: blockProgressError } = await supabase.from('coder_block_progress').delete().eq('coder_id', userId);
  if (blockProgressError) {
    throw new Error(`Failed to delete coder block progress: ${blockProgressError.message}`);
  }

  // Delete from Supabase Auth (ignore errors if not exists)
  const { error: authError } = await supabase.auth.admin.deleteUser(userId);
  if (authError) {
    console.error(`Failed to delete user from auth: ${authError.message}`);
  }

  // Finally delete the user record
  const { error: dbError } = await supabase.from('users').delete().eq('id', userId);

  if (dbError) {
    throw new Error(`Failed to delete user record: ${dbError.message}`);
  }
}
