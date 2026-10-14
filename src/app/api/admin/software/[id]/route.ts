import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { getSoftwareById, updateSoftware, deleteSoftware } from '@/lib/dao/softwareDao';
import { normalizeSoftwareLogoUrl } from '@/lib/softwareLogos';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        await getSessionOrThrow();
        const { id } = await params;
        const software = await getSoftwareById(id);

        if (!software) {
            return NextResponse.json({ error: 'Software not found' }, { status: 404 });
        }

        return NextResponse.json(software);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: RouteParams) {
    try {
        const session = await getSessionOrThrow();
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const existing = await getSoftwareById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Software not found' }, { status: 404 });
        }

        const body = await request.json();
        const { name, description, version, installationUrl, installationInstructions, minimumSpecs, accessInfo, iconUrl } = body;
        if (iconUrl !== undefined && iconUrl !== null && (typeof iconUrl !== 'string' || (iconUrl.trim() && !normalizeSoftwareLogoUrl(iconUrl)))) {
            return NextResponse.json({ error:'URL logo harus berupa gambar HTTPS yang valid.' }, { status:400 });
        }

        const software = await updateSoftware(id, {
            name,
            description,
            version,
            installationUrl,
            installationInstructions,
            minimumSpecs,
            accessInfo,
            iconUrl: iconUrl === undefined ? undefined : normalizeSoftwareLogoUrl(iconUrl),
        });

        return NextResponse.json(software);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    try {
        const session = await getSessionOrThrow();
        if (session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { id } = await params;
        const existing = await getSoftwareById(id);
        if (!existing) {
            return NextResponse.json({ error: 'Software not found' }, { status: 404 });
        }

        await deleteSoftware(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
