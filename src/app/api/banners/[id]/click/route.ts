import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const BANNERS_JSON = path.join(process.cwd(), 'public', 'banners', 'banners.json');

type Banner = {
    id: string;
    imagePath: string;
    linkUrl: string;
    title: string;
    order: number;
    isActive: boolean;
    clicks?: number;
};

type BannersData = {
    banners: Banner[];
};

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const id = params.id;

        // Ensure id exists
        if (!id) {
            return NextResponse.json({ error: 'Banner ID missing' }, { status: 400 });
        }

        // Read current banners
        const dataStr = await fs.readFile(BANNERS_JSON, 'utf-8');
        const data: BannersData = JSON.parse(dataStr);

        // Find the banner
        const bannerIndex = data.banners.findIndex(b => b.id === id);

        if (bannerIndex === -1) {
            return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
        }

        // Increment clicks
        const currentBanner = data.banners[bannerIndex];
        currentBanner.clicks = (currentBanner.clicks || 0) + 1;

        // Write back out to file
        await fs.writeFile(BANNERS_JSON, JSON.stringify(data, null, 2));

        // Use the proper Next.js redirect to smoothly send user to final destination
        return NextResponse.redirect(currentBanner.linkUrl);

    } catch (error) {
        console.error('Error tracking banner click:', error);
        // Better error handling - if everything fails just redirect to home so the user isn't stuck natively
        // but since we don't have the original url easily if read fails, fallback error msg:
        return NextResponse.json({ error: 'Failed to process tracking' }, { status: 500 });
    }
}
