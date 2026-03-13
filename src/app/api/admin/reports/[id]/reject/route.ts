import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { sendWhatsAppMessage } from '@/lib/services/whatsappClient';

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
    //    Store revision notes so coach knows what to fix in the report description
    const { error: updateError } = await supabase
      .from('block_reports')
      .update({
        status: 'DRAFT',
        revision_notes: revisionNotes || null,
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

    // 4. Send WA to Coach
    if (coachPhone) {
      const coderName = coderData?.full_name || 'Siswa';
      const className = (report.class as any)?.name || 'Kelas';
      
      const message = `Halo ${coachName}, admin telah mengembalikan draf rapor untuk Coder *${coderName}* di kelas *${className}* untuk direvisi.\n\n*Catatan Revisi dari Admin:*\n"${revisionNotes || 'Mohon diperbaiki deskripsinya.'}"\n\nSilakan buka portal Coach Clevio untuk memperbaiki dan submit ulang rapor tersebut. Terima kasih!`;

      await sendWhatsAppMessage(coachPhone, message);
    }

    return NextResponse.json({ success: true, message: 'Rapor telah dikembalikan ke Coach untuk direvisi.' });
  } catch (error: any) {
    console.error('[RejectReport API] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal error' }, { status: 500 });
  }
}


