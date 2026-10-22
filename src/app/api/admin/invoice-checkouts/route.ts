import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/authOptions';
import { getInvoiceById, INVOICE_ITEMS_WITH_BILLING_DURATION } from '@/lib/dao/invoicesDao';
import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { createCheckoutLink, checkoutPreview, requireInvoiceCheckoutEnabled, CheckoutError } from '@/lib/services/invoiceCheckoutServer';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    requireInvoiceCheckoutEnabled();
    const id = request.nextUrl.searchParams.get('invoiceId');
    if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Invoice tidak valid.' }, { status: 400 });
    const invoice = await getInvoiceById(id!);
    if (!invoice?.ccr_id || invoice.invoice_type !== 'MONTHLY') return NextResponse.json({ error: 'Pilih invoice kelas bulanan yang memiliki CCR.' }, { status: 400 });
    const { data, error } = await getSupabaseAdmin().from('invoices' as any).select(`*,${INVOICE_ITEMS_WITH_BILLING_DURATION}`)
      .eq('ccr_id', invoice.ccr_id).eq('parent_phone', invoice.parent_phone).eq('invoice_type', 'MONTHLY')
      .in('status', ['PENDING', 'OVERDUE']).order('period_year').order('period_month').limit(25);
    if (error) throw new CheckoutError('Daftar invoice tidak dapat dibaca.', 503);
    if (data && data.length > 24) throw new CheckoutError('Ada lebih dari 24 tagihan. Periksa rincian tunggakan terlebih dahulu; sistem tidak akan memotong daftar otomatis.');
    return NextResponse.json({ invoices: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return NextResponse.json({ error: e instanceof CheckoutError ? e.message : 'Gagal memuat invoice.' }, { status: e instanceof CheckoutError ? e.status : 500 }); }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = z.object({ invoiceIds: z.array(z.string().uuid()).min(1).max(24) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Pilih 1–24 invoice.' }, { status: 400 });
  try {
    const link = await createCheckoutLink(parsed.data.invoiceIds, session.user.id);
    return NextResponse.json({ id: link.id, ...await checkoutPreview(link) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : 'Gagal membuat link.' }, { status: e instanceof CheckoutError ? e.status : 400 }); }
}
