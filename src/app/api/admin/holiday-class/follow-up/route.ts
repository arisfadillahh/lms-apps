import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { canAccessMenu } from '@/lib/permissions';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function GET(request: Request) {
  const session = await getSessionOrThrow().catch(() => null);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role !== 'ADMIN' || !canAccessMenu(session.user.username, session.user.adminPermissions ?? null, 'invoices')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const page = Math.max(0, Math.min(10000, Number(new URL(request.url).searchParams.get('page')) || 0));
  const { data, error } = await getSupabaseAdmin().from('holiday_class_registrations' as never)
    .select('id,created_at,selections,invoices!inner(invoice_number,parent_name,parent_phone,status,paid_at),holiday_class_whatsapp_outbox(id,kind,sent_at,failed_at,last_error,attempts)')
    .in('invoices.status', ['PENDING','OVERDUE']).is('invoices.paid_at', null)
    .order('created_at', { ascending: false }).range(Math.floor(page)*50,Math.floor(page)*50+49);
  if (error) return NextResponse.json({ error: 'Daftar follow-up belum tersedia' }, { status: 503 });
  const rows = (data ?? []) as unknown as Array<{ id:string;created_at:string;selections:unknown;invoices:{ invoice_number:string;parent_name:string;parent_phone:string };holiday_class_whatsapp_outbox:Array<{id:number;kind:string;sent_at:string|null;failed_at:string|null;last_error:string|null;attempts:number}> }>;
  return NextResponse.json({ data: rows.map(r=>({ id:r.id,createdAt:r.created_at,programs:r.selections,invoiceNumber:r.invoices.invoice_number,
    parentName:r.invoices.parent_name,phoneLast4:r.invoices.parent_phone.slice(-4),lastWhatsApp:r.holiday_class_whatsapp_outbox.filter(n=>n.kind==='invoice_parent'||n.kind.startsWith('reminder_')).sort((a,b)=>b.id-a.id)[0]??null })),page },
  { headers: { 'Cache-Control':'private, no-store' } });
}
