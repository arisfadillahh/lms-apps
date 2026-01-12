import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { getSoftwareByBlockId, setSoftwareForBlock } from '@/lib/dao/blockSoftwareDao';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
    try {
        await getSessionOrThrow();
        const { id } = await params;
        const software = await getSoftwareByBlockId(id);
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

        const { id: blockId } = await params;
        const body = await request.json();
        const { softwareIds } = body;

        if (!Array.isArray(softwareIds)) {
            return NextResponse.json({ error: 'softwareIds must be an array' }, { status: 400 });
        }

        await setSoftwareForBlock(blockId, softwareIds);
        const updatedSoftware = await getSoftwareByBlockId(blockId);
        return NextResponse.json(updatedSoftware);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
