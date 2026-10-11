import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getServerAuthSession } from '@/lib/auth';
import { consumeRateLimit } from '@/lib/rateLimit';
import { normalizeSafePageReference } from '@/lib/safeUrl';
import { detectAvatarImageType } from '@/lib/services/avatarUploadSecurity';

const BANNERS_DIR = path.join(process.cwd(), 'public', 'banners');
const BANNERS_JSON = path.join(BANNERS_DIR, 'banners.json');
const MAX_BANNER_BYTES = 5 * 1024 * 1024;

async function requireAdmin(): Promise<NextResponse | null> {
    const session = await getServerAuthSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return null;
}

type Banner = {
    id: string;
    imagePath: string;
    linkUrl: string;
    title: string;
    order: number;
    isActive: boolean;
};

type BannersData = {
    banners: Banner[];
};

async function readBanners(): Promise<BannersData> {
    try {
        const data = await fs.readFile(BANNERS_JSON, 'utf-8');
        return JSON.parse(data);
    } catch {
        return { banners: [] };
    }
}

async function writeBanners(data: BannersData): Promise<void> {
    await fs.mkdir(BANNERS_DIR, { recursive: true });
    await fs.writeFile(BANNERS_JSON, JSON.stringify(data, null, 2));
}

// GET - List all banners
export async function GET() {
    const denied = await requireAdmin();
    if (denied) return denied;
    const data = await readBanners();
    return NextResponse.json(data);
}

// POST - Create new banner (with image upload)
export async function POST(request: NextRequest) {
    try {
        const denied = await requireAdmin();
        if (denied) return denied;
        if (!await consumeRateLimit({ request, scope: 'admin-banner-upload', maxRequests: 20, windowSeconds: 60 * 60 })) {
            return NextResponse.json({ error: 'Terlalu banyak upload banner. Silakan coba lagi nanti.' }, { status: 429 });
        }
        const formData = await request.formData();
        const image = formData.get('image') as File | null;
        const requestedLinkUrl = String(formData.get('linkUrl') || '').trim();
        const linkUrl = normalizeSafePageReference(requestedLinkUrl);
        const title = String(formData.get('title') || 'Banner').trim().slice(0, 120) || 'Banner';

        if (!image) {
            return NextResponse.json({ error: 'Image is required' }, { status: 400 });
        }

        if (requestedLinkUrl && !linkUrl) {
            return NextResponse.json({ error: 'Link banner harus berupa URL HTTP(S) atau path internal yang aman' }, { status: 400 });
        }
        if (image.size > MAX_BANNER_BYTES) {
            return NextResponse.json({ error: 'Ukuran banner maksimal 5 MB' }, { status: 400 });
        }
        const buffer = Buffer.from(await image.arrayBuffer());
        const imageType = detectAvatarImageType(image.type, buffer);
        if (!imageType || imageType.contentType === 'image/gif') {
            return NextResponse.json({ error: 'Banner harus berupa PNG, JPG, atau WebP yang valid' }, { status: 400 });
        }

        const filename = `${uuidv4()}${imageType.extension}`;
        const imagePath = `/banners/${filename}`;
        const fullPath = path.join(BANNERS_DIR, filename);

        // Save image to public/banners
        await fs.mkdir(BANNERS_DIR, { recursive: true });
        await fs.writeFile(fullPath, buffer, { flag: 'wx' });

        // Add banner to JSON
        const data = await readBanners();
        const newBanner: Banner = {
            id: uuidv4(),
            imagePath,
            linkUrl: linkUrl || '',
            title,
            order: data.banners.length,
            isActive: true,
        };
        data.banners.push(newBanner);
        await writeBanners(data);

        return NextResponse.json(newBanner, { status: 201 });
    } catch (error) {
        console.error('Error creating banner:', error);
        return NextResponse.json({ error: 'Failed to create banner' }, { status: 500 });
    }
}

// PUT - Update banner
export async function PUT(request: NextRequest) {
    try {
        const denied = await requireAdmin();
        if (denied) return denied;
        const body = await request.json();
        const { id, linkUrl, title, order, isActive } = body;

        if (!id) {
            return NextResponse.json({ error: 'Banner ID is required' }, { status: 400 });
        }

        const data = await readBanners();
        const bannerIndex = data.banners.findIndex(b => b.id === id);

        if (bannerIndex === -1) {
            return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
        }

        // Update fields if provided
        if (linkUrl !== undefined) {
            const safeLinkUrl = normalizeSafePageReference(String(linkUrl).trim());
            if (linkUrl && !safeLinkUrl) return NextResponse.json({ error: 'Link banner tidak valid' }, { status: 400 });
            data.banners[bannerIndex].linkUrl = safeLinkUrl || '';
        }
        if (title !== undefined) data.banners[bannerIndex].title = String(title).trim().slice(0, 120) || 'Banner';
        if (order !== undefined) data.banners[bannerIndex].order = order;
        if (isActive !== undefined) data.banners[bannerIndex].isActive = isActive;

        await writeBanners(data);

        return NextResponse.json(data.banners[bannerIndex]);
    } catch (error) {
        console.error('Error updating banner:', error);
        return NextResponse.json({ error: 'Failed to update banner' }, { status: 500 });
    }
}

// DELETE - Delete banner
export async function DELETE(request: NextRequest) {
    try {
        const denied = await requireAdmin();
        if (denied) return denied;
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'Banner ID is required' }, { status: 400 });
        }

        const data = await readBanners();
        const banner = data.banners.find(b => b.id === id);

        if (!banner) {
            return NextResponse.json({ error: 'Banner not found' }, { status: 404 });
        }

        // Delete image file
        const imagePath = path.join(process.cwd(), 'public', banner.imagePath);
        try {
            await fs.unlink(imagePath);
        } catch {
            // Image may already be deleted, continue
        }

        // Remove from JSON
        data.banners = data.banners.filter(b => b.id !== id);
        await writeBanners(data);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting banner:', error);
        return NextResponse.json({ error: 'Failed to delete banner' }, { status: 500 });
    }
}

// PATCH - Reorder banners (bulk update)
export async function PATCH(request: NextRequest) {
    try {
        const denied = await requireAdmin();
        if (denied) return denied;
        const body = await request.json();
        const { orderedIds } = body as { orderedIds: string[] };

        if (!orderedIds || !Array.isArray(orderedIds)) {
            return NextResponse.json({ error: 'orderedIds array is required' }, { status: 400 });
        }

        const data = await readBanners();

        // Update order based on position in array
        orderedIds.forEach((id, index) => {
            const banner = data.banners.find(b => b.id === id);
            if (banner) {
                banner.order = index;
            }
        });

        // Sort by new order
        data.banners.sort((a, b) => a.order - b.order);
        await writeBanners(data);

        return NextResponse.json({ success: true, banners: data.banners });
    } catch (error) {
        console.error('Error reordering banners:', error);
        return NextResponse.json({ error: 'Failed to reorder banners' }, { status: 500 });
    }
}
