import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/authOptions';
import { getCheckoutLink, CheckoutError, requireInvoiceCheckoutEnabled } from '@/lib/services/invoiceCheckoutServer';
import { sendCheckoutMessage } from '@/lib/services/invoiceCheckoutMessaging';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    requireInvoiceCheckoutEnabled();
    const { previewHash } = await request.json().catch(() => ({}));
    if (typeof previewHash !== 'string' || !/^[a-f0-9]{64}$/.test(previewHash)) throw new CheckoutError('Preview pesan wajib diperiksa sebelum mengirim.', 400);
    const link = await getCheckoutLink((await params).id);
    if (!link) throw new CheckoutError('Link tidak ditemukan.', 404);
    return NextResponse.json(await sendCheckoutMessage(link, previewHash));
  } catch (e) { return NextResponse.json({ error: e instanceof CheckoutError ? e.message : 'Gagal mengirim pesan.' }, { status: e instanceof CheckoutError ? e.status : 500 }); }
}
