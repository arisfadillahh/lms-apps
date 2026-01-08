import { NextResponse, type NextRequest } from 'next/server';

import { hashPassword } from '@/lib/passwords';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

type ResetBody = {
  newPassword?: string;
};

const DEFAULT_PASSWORD = process.env.DEV_ADMIN_RESET_PASSWORD ?? 'admin123';
const DEFAULT_USERNAME = process.env.DEV_ADMIN_USERNAME ?? 'admin';
const DEFAULT_FULL_NAME = process.env.DEV_ADMIN_FULLNAME ?? 'Dev Admin';

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  let body: ResetBody = {};
  try {
    body = (await request.json()) as ResetBody;
  } catch (_) {
    // ignore bad JSON and fall back to defaults
  }

  const newPassword = (body.newPassword ?? '').trim() || DEFAULT_PASSWORD;

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (error) {
    console.error('[reset-admin] Missing Supabase credentials', error);
    return NextResponse.json({ error: 'Supabase admin client unavailable' }, { status: 500 });
  }

  const passwordHash = await hashPassword(newPassword);

  const { data: existingAdmin, error: fetchError } = await supabase
    .from('users')
    .select('*')
    .eq('username', DEFAULT_USERNAME)
    .maybeSingle();

  if (fetchError) {
    console.error('[reset-admin] Failed to fetch admin user', fetchError);
    return NextResponse.json({ error: 'Unable to fetch admin user' }, { status: 500 });
  }

  if (existingAdmin) {
    const { error: updateError } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        is_active: true,
        role: 'ADMIN',
        full_name: existingAdmin.full_name ?? DEFAULT_FULL_NAME,
      })
      .eq('id', existingAdmin.id);

    if (updateError) {
      console.error('[reset-admin] Failed to update admin password', updateError);
      return NextResponse.json({ error: 'Unable to update admin password' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: 'updated',
      username: DEFAULT_USERNAME,
      password: newPassword,
    });
  }

  const { data: created, error: insertError } = await supabase
    .from('users')
    .insert({
      username: DEFAULT_USERNAME,
      password_hash: passwordHash,
      full_name: DEFAULT_FULL_NAME,
      role: 'ADMIN',
      is_active: true,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[reset-admin] Failed to create admin user', insertError);
    return NextResponse.json({ error: 'Unable to create admin user' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    action: 'created',
    username: DEFAULT_USERNAME,
    password: newPassword,
    id: created?.id,
  });
}
