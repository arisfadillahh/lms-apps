import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

type CertificateTemplateInput = {
    key?: string;
    name?: string;
    version?: number;
    layout?: Record<string, unknown>;
};

export type CreateCertificateInput = {
    externalReference: string;
    studentName: string;
    programName: string;
    classNames: string[];
    levelName?: string | null;
    dateRange?: string | null;
    issuedDate?: string | null;
    certificateNumber?: string | null;
    template?: CertificateTemplateInput;
};

export type StoredCertificate = {
    id: string;
    token: string;
    external_reference: string;
    certificate_number: string;
    student_name: string;
    program_name: string;
    class_names: string[];
    level_name: string | null;
    date_range: string | null;
    issued_date: string;
    template_key: string;
    template_name: string;
    template_version: number;
    layout_json: Record<string, unknown>;
    created_at: string;
};

type CertificateStore = {
    version: 1;
    rows: StoredCertificate[];
};

const STORE_RELATIVE_PATH = ['.data', 'certificates.json'];
let certificateStoreQueue = Promise.resolve();

export async function createCertificate(input: CreateCertificateInput) {
    return withStoreLock(async () => {
        const store = await readStore();
        const now = new Date().toISOString();
        const existing = store.rows.find((row) => row.external_reference === input.externalReference && row.certificate_number === input.certificateNumber);
        if (existing) {
            return toCertificateResponse(existing);
        }

        const id = crypto.randomUUID();
        const token = crypto.randomBytes(18).toString('base64url');
        const row: StoredCertificate = {
            id,
            token,
            external_reference: sanitizeText(input.externalReference, 120),
            certificate_number: sanitizeText(input.certificateNumber || buildCertificateNumber(input.externalReference), 80),
            student_name: sanitizeText(input.studentName, 160),
            program_name: sanitizeText(input.programName, 180),
            class_names: input.classNames.map((item) => sanitizeText(item, 120)).filter(Boolean).slice(0, 8),
            level_name: input.levelName ? sanitizeText(input.levelName, 80) : null,
            date_range: input.dateRange ? sanitizeText(input.dateRange, 120) : null,
            issued_date: sanitizeText(input.issuedDate || now.slice(0, 10), 40),
            template_key: sanitizeText(input.template?.key || 'default', 80),
            template_name: sanitizeText(input.template?.name || 'Clevio Certificate', 120),
            template_version: Number(input.template?.version ?? 1),
            layout_json: normalizeLayout(input.template?.layout),
            created_at: now
        };

        store.rows.unshift(row);
        await writeStore(store);
        return toCertificateResponse(row);
    });
}

export async function getCertificateByToken(token: string) {
    if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) return null;
    const store = await readStore();
    return store.rows.find((row) => row.token === token) ?? null;
}

function toCertificateResponse(row: StoredCertificate) {
    return {
        certificate_id: row.id,
        certificate_number: row.certificate_number,
        certificate_url: `${resolvePublicBaseUrl().replace(/\/+$/, '')}/certificate/${encodeURIComponent(row.token)}`,
        status: 'generated',
        template_version: row.template_version
    };
}

function resolvePublicBaseUrl() {
    return process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://lms.clev.io';
}

function buildCertificateNumber(reference: string) {
    const suffix = crypto.createHash('sha1').update(reference).digest('hex').slice(0, 8).toUpperCase();
    return `CERT-${suffix}`;
}

function normalizeLayout(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    const input = value as Record<string, unknown>;
    return {
        primaryColor: normalizeColor(input.primaryColor, '#057BE3'),
        accentColor: normalizeColor(input.accentColor, '#F2B929'),
        backgroundUrl: normalizeAssetUrl(input.backgroundUrl),
        logoUrl: normalizeAssetUrl(input.logoUrl),
        signatureName: sanitizeText(String(input.signatureName ?? 'Clevio'), 100)
    };
}

function normalizeColor(value: unknown, fallback: string) {
    if (typeof value !== 'string') return fallback;
    const trimmed = value.trim();
    return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

function normalizeAssetUrl(value: unknown) {
    if (typeof value !== 'string' || !value.trim()) return null;
    try {
        const parsed = new URL(value.trim());
        if (!['https:', 'http:'].includes(parsed.protocol)) return null;
        return parsed.toString();
    } catch {
        return null;
    }
}

function sanitizeText(value: string, maxLength: number) {
    return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, maxLength);
}

async function withStoreLock<T>(work: () => Promise<T>) {
    const next = certificateStoreQueue.then(work, work);
    certificateStoreQueue = next.then(
        () => undefined,
        () => undefined
    );
    return next;
}

async function readStore(): Promise<CertificateStore> {
    try {
        const content = await fs.readFile(getStorePath(), 'utf8');
        const parsed = JSON.parse(content) as Partial<CertificateStore>;
        if (!Array.isArray(parsed.rows)) return { version: 1, rows: [] };
        return {
            version: 1,
            rows: parsed.rows.filter((row): row is StoredCertificate => Boolean(row?.id && row?.token && row?.certificate_number))
        };
    } catch (error: any) {
        if (error?.code === 'ENOENT') return { version: 1, rows: [] };
        throw error;
    }
}

async function writeStore(store: CertificateStore) {
    const storePath = getStorePath();
    await fs.mkdir(path.dirname(storePath), { recursive: true });
    const tmpPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(store, null, 2), { encoding: 'utf8', mode: 0o600 });
    await fs.rename(tmpPath, storePath);
}

function getStorePath() {
    return process.env.CERTIFICATE_STORE_PATH || path.join(/* turbopackIgnore: true */ process.cwd(), ...STORE_RELATIVE_PATH);
}
