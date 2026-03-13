import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { notificationsDao } from '@/lib/dao';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionOrThrow();
    await assertRole(sessionUser, 'ADMIN');

    const resolvedParams = await params;
    const reportId = resolvedParams.id;

    const { revisionNotes } = await req.json().catch(() => ({ revisionNotes: '' }));

    const supabase = getSupabaseAdmin();

    // 1. Get report details
    const { data: report, error: reportError } = await supabase
      .from('block_reports')
      .select(`
        id, class_id, block_id, coder_id,
        class:classes(name, coach_id)
      `)
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Rapor tidak ditemukan' }, { status: 404 });
    }

    // 2. Revert report status to DRAFT (don't delete — scores remain intact)
    const { error: updateError } = await supabase
      .from('block_reports')
      .update({
        status: 'DRAFT',
      })
      .eq('id', reportId);

    if (updateError) {
      throw new Error(`Gagal mengembalikan rapor: ${updateError.message}`);
    }

    // 3. Get Coder & Coach info for WA notification
    const { data: coderData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', report.coder_id)
      .single();

    const coachId = (report.class as any)?.coach_id;
    let coachPhone = null;
    let coachName = 'Coach';

    if (coachId) {
      const { data: coachData } = await supabase
        .from('users')
        .select('full_name, parent_contact_phone')
        .eq('id', coachId)
        .single();
        
      if (coachData) {
        coachPhone = coachData.parent_contact_phone;
        coachName = coachData.full_name || 'Coach';
      }
    }

    // 4. Create In-App Notification for Coach
    if (coachId) {
      const coderName = coderData?.full_name || 'Siswa';
      const className = (report.class as any)?.name || 'Kelas';
      
      const title = 'Rapor Perlu Revisi';
      const message = `
        <p>Admin telah mengembalikan draf rapor untuk <strong>${coderName}</strong> di kelas <strong>${className}</strong> untuk direvisi.</p>
        <div style="background: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; margin: 12px 0;">
          <p style="margin: 0; font-weight: 600; color: #991b1b;">Catatan Revisi dari Admin:</p>
          <p style="margin: 4px 0 0 0; color: #b91c1c;">"${revisionNotes || 'Mohon diperbaiki deskripsinya.'}"</p>
        </div>
        <p>Silakan perbaiki dan submit ulang rapor tersebut melalui portal Coach. Terima kasih!</p>
      `.trim();

      await notificationsDao.createNotification(coachId, title, message, 'REVISION_REQUIRED');
    }

    return NextResponse.json({ success: true, message: 'Rapor telah dikembalikan ke Coach untuk direvisi.' });
  } catch (error: any) {
    console.error('[RejectReport API] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}


