import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

import { authOptions } from '@/lib/authOptions';
import { getInvoiceById, getInvoiceSettings } from '@/lib/dao/invoicesDao';
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';

type RouteParams = { params: Promise<{ id: string }> };

function resolvePublicBaseUrl(baseUrl?: string | null): string {
    return baseUrl?.trim()
        || process.env.NEXT_PUBLIC_APP_URL?.trim()
        || process.env.NEXT_PUBLIC_BASE_URL?.trim()
        || process.env.NEXTAUTH_URL?.trim()
        || 'https://lms.clev.io';
}

export async function GET(_request: Request, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const invoice = await getInvoiceById(id);
    if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const settings = await getInvoiceSettings();
    const publicUrl = buildInvoicePublicUrl(resolvePublicBaseUrl(settings?.base_url), invoice);

    return NextResponse.redirect(publicUrl);
}
