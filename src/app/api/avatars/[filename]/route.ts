import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { getStoredAvatarContentType, isAllowedAvatarFilename } from '@/lib/services/avatarUploadSecurity';
import { getAvatarUploadDir } from '@/lib/services/avatarStorage';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ filename: string }> }
) {
    const { filename } = await params;

    // Security: Prevent directory traversal
    const safeFilename = path.basename(filename);
    if (safeFilename !== filename || !isAllowedAvatarFilename(safeFilename)) {
        return new NextResponse('File not found', { status: 404 });
    }

    const filePath = path.join(getAvatarUploadDir(), safeFilename);

    try {
        const fileBuffer = await readFile(filePath);
        const contentType = getStoredAvatarContentType(safeFilename, fileBuffer);

        if (!contentType) {
            return new NextResponse('File not found', { status: 404 });
        }

        return new NextResponse(new Uint8Array(fileBuffer), {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600, must-revalidate',
                'X-Content-Type-Options': 'nosniff',
            }
        });
    } catch (error: unknown) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return new NextResponse('File not found', { status: 404 });
        }

        console.error('Error reading avatar file:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
