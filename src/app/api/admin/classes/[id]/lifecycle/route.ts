import { NextResponse } from 'next/server';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { updateClassLifecycleSchema } from '@/lib/validation/admin';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');
    const { id } = await context.params;
    const parsed = updateClassLifecycleSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'Status kelas tidak valid' }, { status: 400 });

    const { data, error } = await (getSupabaseAdmin() as any).rpc('set_class_lifecycle_status', {
      p_class_id: id,
      p_status: parsed.data.status,
      p_admin_id: session.user.id,
    });
    if (error) throw new Error(error.message);
    return NextResponse.json({ success: true, cancelledSessions: Number(data ?? 0) });
  } catch (error) {
    console.error('[ClassLifecycle] Failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Gagal memperbarui status kelas' }, { status: 400 });
  }
}
