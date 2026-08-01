import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { getSupabaseAdmin } from '@/lib/supabaseServer';

type ShortLinkInput = {
    targetUrl: string;
    linkType?: string;
    entityType?: string;
    entityId?: string | null;
    metadata?: Record<string, unknown>;
    expiresAt?: string | null;
};

type InvoiceShortLinkRecord = {
    id?: string;
    invoice_number: string;
    parent_phone: string;
    total_amount: number;
};

type ShortLinkRow = {
    slug: string;
    target_url: string;
};

type NormalizedShortLinkInput = Omit<ShortLinkInput, 'targetUrl' | 'linkType' | 'entityType' | 'entityId'> & {
    targetUrl: string;
    linkType: string;
    entityType: string | null;
    entityId: string | null;
};

type FileShortLinkRow = {
    slug: string;
    target_url: string;
    link_type: string;
    entity_type: string | null;
    entity_id: string | null;
    metadata_json: Record<string, unknown>;
    is_active: boolean;
    access_count: number;
    expires_at: string | null;
    created_at: string;
    updated_at: string;
    last_accessed_at?: string | null;
};

type FileShortLinkStore = {
    version: 1;
    rows: FileShortLinkRow[];
};

const SLUG_LENGTH = 10;
const MAX_COLLISION_RETRIES = 8;
const DEFAULT_FILE_STORE_RELATIVE = ['.data', 'short-links.json'];
let fileStoreQueue = Promise.resolve();

export async function getOrCreateShortLink(input: ShortLinkInput, baseUrl?: string) {
    const normalizedInput: NormalizedShortLinkInput = {
        ...input,
        targetUrl: normalizeAllowedTargetUrl(input.targetUrl),
        linkType: sanitizeToken(input.linkType || 'invoice'),
        entityType: input.entityType ? sanitizeToken(input.entityType) : null,
        entityId: input.entityId?.trim() || null
    };

    try {
        return await getOrCreateShortLinkFromDatabase(normalizedInput, baseUrl);
    } catch (error) {
        if (!shouldUseFileFallback(error)) throw error;
        console.warn('[ShortLinks] short_links table unavailable, using file store fallback.');
        return getOrCreateShortLinkFromFile(normalizedInput, baseUrl);
    }
}

async function getOrCreateShortLinkFromDatabase(input: NormalizedShortLinkInput, baseUrl?: string) {
    const targetUrl = input.targetUrl;
    const linkType = input.linkType;
    const entityType = input.entityType;
    const entityId = input.entityId;
    const supabase = getSupabaseAdmin();

    if (entityType && entityId) {
        const { data: existing, error } = await (supabase as any)
            .from('short_links')
            .select('slug,target_url')
            .eq('link_type', linkType)
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .eq('is_active', true)
            .maybeSingle();

        if (error) throw error;
        if (existing?.slug) {
            if (existing.target_url !== targetUrl) {
                const { error: updateError } = await (supabase as any)
                    .from('short_links')
                    .update({
                        target_url: targetUrl,
                        metadata_json: input.metadata || {},
                        expires_at: input.expiresAt || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('slug', existing.slug);
                if (updateError) throw updateError;
            }
            return buildShortUrl(existing.slug, baseUrl);
        }
    } else {
        const { data: existing, error } = await (supabase as any)
            .from('short_links')
            .select('slug,target_url')
            .eq('link_type', linkType)
            .eq('target_url', targetUrl)
            .eq('is_active', true)
            .limit(1)
            .maybeSingle();

        if (error) throw error;
        if (existing?.slug) return buildShortUrl(existing.slug, baseUrl);
    }

    for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
        const slug = createRandomSlug();
        const { data, error } = await (supabase as any)
            .from('short_links')
            .insert({
                slug,
                target_url: targetUrl,
                link_type: linkType,
                entity_type: entityType,
                entity_id: entityId,
                metadata_json: input.metadata || {},
                expires_at: input.expiresAt || null
            })
            .select('slug,target_url')
            .single();

        if (!error && data?.slug) return buildShortUrl(data.slug, baseUrl);

        const errorCode = String(error?.code || '');
        if (errorCode === '23505' && entityType && entityId) {
            const { data: existing } = await (supabase as any)
                .from('short_links')
                .select('slug,target_url')
                .eq('link_type', linkType)
                .eq('entity_type', entityType)
                .eq('entity_id', entityId)
                .eq('is_active', true)
                .maybeSingle();
            if (existing?.slug) return buildShortUrl(existing.slug, baseUrl);
        }

        if (!['23505'].includes(errorCode)) {
            throw new Error(error?.message || 'Failed to create short link');
        }
    }

    throw new Error('Failed to create unique short link');
}

async function getOrCreateShortLinkFromFile(input: NormalizedShortLinkInput, baseUrl?: string) {
    return withFileStoreLock(async () => {
        const store = await readFileStore();
        const now = new Date().toISOString();
        const existing = input.entityType && input.entityId
            ? store.rows.find((row) => row.is_active && row.link_type === input.linkType && row.entity_type === input.entityType && row.entity_id === input.entityId)
            : store.rows.find((row) => row.is_active && row.link_type === input.linkType && row.target_url === input.targetUrl);

        if (existing) {
            existing.target_url = input.targetUrl;
            existing.metadata_json = input.metadata || {};
            existing.expires_at = input.expiresAt || null;
            existing.updated_at = now;
            await writeFileStore(store);
            return buildShortUrl(existing.slug, baseUrl);
        }

        for (let attempt = 0; attempt < MAX_COLLISION_RETRIES; attempt += 1) {
            const slug = createRandomSlug();
            if (store.rows.some((row) => row.slug === slug)) continue;
            store.rows.push({
                slug,
                target_url: input.targetUrl,
                link_type: input.linkType,
                entity_type: input.entityType,
                entity_id: input.entityId,
                metadata_json: input.metadata || {},
                is_active: true,
                access_count: 0,
                expires_at: input.expiresAt || null,
                created_at: now,
                updated_at: now,
                last_accessed_at: null
            });
            await writeFileStore(store);
            return buildShortUrl(slug, baseUrl);
        }

        throw new Error('Failed to create unique short link');
    });
}

export async function getOrCreateInvoiceShortUrl(longUrl: string, invoice: InvoiceShortLinkRecord, baseUrl?: string) {
    return getOrCreateShortLink(
        {
            targetUrl: longUrl,
            linkType: 'invoice',
            entityType: 'invoice',
            entityId: invoice.id || invoice.invoice_number,
            metadata: {
                invoice_number: invoice.invoice_number,
                total_amount: invoice.total_amount
            }
        },
        baseUrl
    );
}

export async function getShortInvoiceUrlOrOriginal(longUrl: string, invoice: InvoiceShortLinkRecord, baseUrl?: string) {
    try {
        return await getOrCreateInvoiceShortUrl(longUrl, invoice, baseUrl);
    } catch (error) {
        console.error('[ShortLinks] Falling back to original invoice URL:', error);
        return longUrl;
    }
}

export async function resolveShortLinkTarget(slug: string) {
    if (!/^[A-Za-z0-9_-]{6,32}$/.test(slug)) return null;

    try {
        const supabase = getSupabaseAdmin();
        const { data, error } = await (supabase as any)
            .from('short_links')
            .select('slug,target_url,expires_at,is_active')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();

        if (error) throw error;
        if (data?.target_url) {
            if (data.expires_at && Date.parse(data.expires_at) < Date.now()) return null;

            let targetUrl: string;
            try {
                targetUrl = normalizeAllowedTargetUrl(data.target_url);
            } catch {
                return null;
            }
            await (supabase as any).rpc('increment_short_link_access', { p_slug: slug }).then(
                () => undefined,
                async () => {
                    await (supabase as any)
                        .from('short_links')
                        .update({ last_accessed_at: new Date().toISOString() })
                        .eq('slug', slug);
                }
            );

            return { targetUrl };
        }

        return resolveShortLinkTargetFromFile(slug);
    } catch (error) {
        if (!shouldUseFileFallback(error)) return null;
        return resolveShortLinkTargetFromFile(slug);
    }
}

export function normalizeAllowedTargetUrl(targetUrl: string) {
    let parsed: URL;
    try {
        parsed = new URL(targetUrl);
    } catch {
        throw new Error('Invalid short link target URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Short link target URL protocol is not allowed');
    }

    const host = parsed.hostname.toLowerCase();
    const allowedHosts = getAllowedHosts();
    if (!allowedHosts.has(host)) {
        throw new Error('Short link target host is not allowed');
    }

    if (!parsed.pathname.startsWith('/invoice/')) {
        throw new Error('Short link target path is not allowed');
    }

    return parsed.toString();
}

function buildShortUrl(slugOrRow: string | ShortLinkRow, baseUrl?: string) {
    const slug = typeof slugOrRow === 'string' ? slugOrRow : slugOrRow.slug;
    const normalizedBase = resolveShortLinkBaseUrl(baseUrl).replace(/\/+$/, '');
    return `${normalizedBase}/i/${encodeURIComponent(slug)}`;
}

function resolveShortLinkBaseUrl(baseUrl?: string) {
    return process.env.SHORT_LINK_BASE_URL
        || process.env.NEXTAUTH_URL
        || process.env.NEXT_PUBLIC_APP_URL
        || process.env.NEXT_PUBLIC_BASE_URL
        || baseUrl
        || 'https://lms.clev.io';
}

function getAllowedHosts() {
    const hosts = new Set(['lms.clev.io', 'clev.io', 'lms.clevio.co']);
    for (const value of [
        process.env.SHORT_LINK_ALLOWED_HOSTS,
        process.env.SHORT_LINK_BASE_URL,
        process.env.NEXTAUTH_URL,
        process.env.NEXT_PUBLIC_APP_URL,
        process.env.NEXT_PUBLIC_BASE_URL
    ]) {
        if (!value) continue;
        for (const part of value.split(',')) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            try {
                hosts.add(new URL(trimmed).hostname.toLowerCase());
            } catch {
                hosts.add(trimmed.toLowerCase());
            }
        }
    }

    if (process.env.NODE_ENV !== 'production') {
        hosts.add('localhost');
        hosts.add('127.0.0.1');
    }

    return hosts;
}

function createRandomSlug() {
    return crypto.randomBytes(9).toString('base64url').slice(0, SLUG_LENGTH);
}

function sanitizeToken(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 40) || 'link';
}

async function resolveShortLinkTargetFromFile(slug: string) {
    return withFileStoreLock(async () => {
        const store = await readFileStore();
        const row = store.rows.find((candidate) => candidate.slug === slug && candidate.is_active);
        if (!row?.target_url) return null;
        if (row.expires_at && Date.parse(row.expires_at) < Date.now()) return null;

        let targetUrl: string;
        try {
            targetUrl = normalizeAllowedTargetUrl(row.target_url);
        } catch {
            return null;
        }

        row.access_count += 1;
        row.last_accessed_at = new Date().toISOString();
        row.updated_at = row.updated_at || row.last_accessed_at;
        await writeFileStore(store);
        return { targetUrl };
    });
}

async function withFileStoreLock<T>(work: () => Promise<T>) {
    const next = fileStoreQueue.then(work, work);
    fileStoreQueue = next.then(
        () => undefined,
        () => undefined
    );
    return next;
}

async function readFileStore(): Promise<FileShortLinkStore> {
    try {
        const content = await fs.readFile(getFileStorePath(), 'utf8');
        const parsed = JSON.parse(content) as Partial<FileShortLinkStore>;
        if (!Array.isArray(parsed.rows)) return { version: 1, rows: [] };
        return {
            version: 1,
            rows: parsed.rows.filter((row): row is FileShortLinkRow => Boolean(row?.slug && row?.target_url))
        };
    } catch (error: any) {
        if (error?.code === 'ENOENT') return { version: 1, rows: [] };
        throw error;
    }
}

async function writeFileStore(store: FileShortLinkStore) {
    const storePath = getFileStorePath();
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    const tmpPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tmpPath, storePath);
}

function getFileStorePath() {
    return process.env.SHORT_LINK_STORE_PATH || path.join(/* turbopackIgnore: true */ process.cwd(), ...DEFAULT_FILE_STORE_RELATIVE);
}

function shouldUseFileFallback(error: unknown) {
    const value = error as { code?: unknown; message?: unknown; details?: unknown };
    const code = String(value?.code || '');
    const message = `${String(value?.message || '')} ${String(value?.details || '')}`.toLowerCase();
    return code === '42P01'
        || code === 'PGRST202'
        || code === 'PGRST205'
        || message.includes('short_links')
        || message.includes('schema cache')
        || (message.includes('relation') && message.includes('does not exist'));
}
