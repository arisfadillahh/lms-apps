import { NextRequest, NextResponse } from 'next/server';

import { resolveShortLinkTarget } from '@/lib/services/shortLinks';

type RouteParams = { params: Promise<{ slug: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
    const { slug } = await params;
    const link = await resolveShortLinkTarget(slug);

    if (!link) {
        return NextResponse.json({ error: 'Short link not found' }, { status: 404 });
    }

    const response = NextResponse.redirect(link.targetUrl, { status: 302 });
    response.headers.set('Cache-Control', 'no-store');
    return response;
}
