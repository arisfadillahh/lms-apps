import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { getOrCreateShortLink } from '@/lib/services/shortLinks';
import { validateBearerToken } from '@/lib/apiTokenAuth';

const createShortLinkSchema = z.object({
    target_url: z.string().url(),
    link_type: z.string().min(1).max(40).optional(),
    entity_type: z.string().min(1).max(40).optional(),
    entity_id: z.string().min(1).max(120).optional(),
    expires_at: z.string().datetime().optional(),
    metadata: z.record(z.string(), z.unknown()).optional()
});

export async function POST(request: NextRequest) {
    const unauthorized = assertCoreApiToken(request);
    if (unauthorized) return unauthorized;

    const body = await request.json().catch(() => null);
    const parsed = createShortLinkSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
    }

    try {
        const payload = parsed.data;
        const shortUrl = await getOrCreateShortLink({
            targetUrl: payload.target_url,
            linkType: payload.link_type,
            entityType: payload.entity_type,
            entityId: payload.entity_id,
            expiresAt: payload.expires_at,
            metadata: payload.metadata
        });

        return NextResponse.json({
            ok: true,
            short_url: shortUrl,
            target_url: payload.target_url
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create short link';
        return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }
}

function assertCoreApiToken(request: NextRequest) {
    const result = validateBearerToken(request, [process.env.LMS_CORE_API_TOKEN]);
    if (result === 'UNCONFIGURED') return NextResponse.json({ error: 'Integration token is not configured' }, { status: 503 });
    return result === 'INVALID' ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) : null;
}
