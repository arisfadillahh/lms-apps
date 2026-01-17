/**
 * Invoices Data Access Object
 * 
 * Handles all database operations for invoices, CCR numbers, and invoice settings.
 */

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type {
    Invoice,
    InvoiceItem,
    InvoiceSettings,
    CCRNumber,
    InvoiceFilters,
    InvoiceListResult,
    InvoiceStatus
} from '@/lib/types/invoice';

// ============================================================================
// Invoice Settings
// ============================================================================

export async function getInvoiceSettings(): Promise<InvoiceSettings | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoice_settings')
        .select('*')
        .limit(1)
        .single();

    if (error) {
        console.error('[InvoicesDao] Error fetching settings:', error);
        return null;
    }

    return data as InvoiceSettings;
}

export async function updateInvoiceSettings(
    settings: Partial<Omit<InvoiceSettings, 'id' | 'updated_at'>>
): Promise<InvoiceSettings | null> {
    const supabase = getSupabaseAdmin();

    // Get the existing settings ID first
    const { data: existing } = await supabase
        .from('invoice_settings')
        .select('id')
        .limit(1)
        .single();

    if (!existing) {
        console.error('[InvoicesDao] No settings record found');
        return null;
    }

    const { data, error } = await supabase
        .from('invoice_settings')
        .update(settings)
        .eq('id', existing.id)
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error updating settings:', error);
        return null;
    }

    return data as InvoiceSettings;
}

// ============================================================================
// CCR Numbers
// ============================================================================

export async function getOrCreateCCR(
    parentPhone: string,
    parentName?: string
): Promise<CCRNumber | null> {
    const supabase = getSupabaseAdmin();

    // Check if CCR already exists for this phone
    const { data: existing } = await supabase
        .from('ccr_numbers')
        .select('*')
        .eq('parent_phone', parentPhone)
        .single();

    if (existing) {
        return existing as CCRNumber;
    }

    // Get next sequence number
    const { data: seqData } = await supabase
        .rpc('get_next_ccr_sequence');

    const nextSeq = seqData || 1;

    // Create new CCR
    const { data: newCCR, error } = await supabase
        .from('ccr_numbers')
        .insert({
            parent_phone: parentPhone,
            ccr_sequence: nextSeq,
            parent_name: parentName || null
        })
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error creating CCR:', error);
        return null;
    }

    return newCCR as CCRNumber;
}

export function formatCCRCode(sequence: number): string {
    return `CCR${String(sequence).padStart(3, '0')}`;
}

export function formatInvoiceNumber(ccrCode: string, month: number, year: number): string {
    const monthStr = String(month).padStart(2, '0');
    return `${ccrCode}-${monthStr}${year}`;
}

// ============================================================================
// CCR Assignment Functions
// ============================================================================

export async function getNextAvailableCCR(): Promise<string> {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .rpc('get_next_ccr_code');

    return data || 'CCR001';
}

export async function getCCRByPhone(parentPhone: string): Promise<CCRNumber | null> {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .from('ccr_numbers')
        .select('*')
        .eq('parent_phone', parentPhone)
        .single();

    return data as CCRNumber | null;
}

export async function getCCRByCode(ccrCode: string): Promise<CCRNumber | null> {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .from('ccr_numbers')
        .select('*')
        .eq('ccr_code', ccrCode)
        .single();

    return data as CCRNumber | null;
}

export async function assignCCRToParent(
    parentPhone: string,
    ccrCode: string,
    parentName?: string
): Promise<CCRNumber | null> {
    const supabase = getSupabaseAdmin();

    // Validate CCR code format
    if (!/^CCR[0-9]{3,}$/.test(ccrCode)) {
        console.error('[InvoicesDao] Invalid CCR code format:', ccrCode);
        return null;
    }

    // Check if CCR code already exists
    const existingCode = await getCCRByCode(ccrCode);
    if (existingCode && existingCode.parent_phone !== parentPhone) {
        console.error('[InvoicesDao] CCR code already assigned to different parent:', ccrCode);
        return null;
    }

    // Check if parent already has CCR
    const existingParent = await getCCRByPhone(parentPhone);
    if (existingParent) {
        return existingParent;
    }

    // Extract sequence from CCR code
    const sequence = parseInt(ccrCode.substring(3), 10);

    // Create new CCR
    const { data: newCCR, error } = await supabase
        .from('ccr_numbers')
        .insert({
            parent_phone: parentPhone,
            ccr_sequence: sequence,
            ccr_code: ccrCode,
            parent_name: parentName || null
        })
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error assigning CCR:', error);
        return null;
    }

    return newCCR as CCRNumber;
}

export async function getCodersWithoutCCR(): Promise<Array<{
    parent_phone: string;
    parent_name: string;
    coders: Array<{ id: string; full_name: string; class_name?: string; level_name?: string }>;
}>> {
    const supabase = getSupabaseAdmin();

    // Get all coders with parent phone
    const { data: coders, error } = await supabase
        .from('users')
        .select(`
            id,
            full_name,
            parent_contact_phone,
            parent_name,
            enrollments(
                classes(
                    name,
                    levels(name)
                )
            )
        `)
        .eq('role', 'CODER')
        .eq('is_active', true)
        .not('parent_contact_phone', 'is', null);

    if (error || !coders) {
        console.error('[InvoicesDao] Error fetching coders:', error);
        return [];
    }

    // Get all existing CCR parent phones
    const { data: existingCCRs } = await supabase
        .from('ccr_numbers')
        .select('parent_phone');

    const ccrPhones = new Set((existingCCRs || []).map(c => c.parent_phone));

    // Filter coders without CCR and group by parent phone
    const groups = new Map<string, {
        parent_phone: string;
        parent_name: string;
        db_parent_names: Set<string>; // Start collecting real parent names
        coders: Array<{ id: string; full_name: string; class_name?: string; level_name?: string }>;
    }>();

    for (const coder of coders) {
        // cast because our select includes parent_name which might missing in strict type inference
        const u = coder as typeof coder & { parent_name: string | null };
        const phone = u.parent_contact_phone;
        if (!phone || ccrPhones.has(phone)) continue;

        const enrollment = (u.enrollments as Array<{ classes: { name: string; levels: { name: string } | null } | null }>)?.[0];
        const className = enrollment?.classes?.name || undefined;
        const levelName = enrollment?.classes?.levels?.name || undefined;

        if (!groups.has(phone)) {
            groups.set(phone, {
                parent_phone: phone,
                parent_name: '',
                db_parent_names: new Set(),
                coders: []
            });
        }

        const group = groups.get(phone)!;

        if (u.parent_name) {
            group.db_parent_names.add(u.parent_name.trim());
        }

        group.coders.push({
            id: u.id,
            full_name: u.full_name,
            class_name: className,
            level_name: levelName
        });
    }

    // Post-process to generate final parent name
    for (const group of groups.values()) {
        const uniqueDbNames = Array.from(group.db_parent_names);

        if (uniqueDbNames.length > 0) {
            // Case 1: Use DB parent names (joined if multiple)
            group.parent_name = uniqueDbNames.join(' / ');
        } else {
            // Case 2: Fallback to "Orang Tua [Student...]" if DB parent_name is empty
            const uniqueStudentNames = Array.from(new Set(group.coders.map(c => c.full_name)));
            group.parent_name = `Orang Tua ${uniqueStudentNames.join(' / ')}`;
        }
    }

    // Cleanup internal set before returning
    return Array.from(groups.values()).map(({ db_parent_names, ...rest }) => rest);
}

export async function getAllCCRs(): Promise<CCRNumber[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('ccr_numbers')
        .select('*')
        .order('ccr_sequence', { ascending: true });

    if (error) {
        console.error('[InvoicesDao] Error fetching CCRs:', error);
        return [];
    }

    return data as CCRNumber[];
}

// ============================================================================
// Invoices
// ============================================================================

export async function createInvoice(data: {
    ccr_id: string;
    ccr_code: string;
    parent_phone: string;
    parent_name: string;
    period_month: number;
    period_year: number;
    total_amount: number;
    due_date: string;
}): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const invoiceNumber = formatInvoiceNumber(
        data.ccr_code,
        data.period_month,
        data.period_year
    );

    const { data: invoice, error } = await supabase
        .from('invoices')
        .insert({
            invoice_number: invoiceNumber,
            ccr_id: data.ccr_id,
            parent_phone: data.parent_phone,
            parent_name: data.parent_name,
            period_month: data.period_month,
            period_year: data.period_year,
            total_amount: data.total_amount,
            due_date: data.due_date,
            status: 'PENDING'
        })
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error creating invoice:', error);
        return null;
    }

    return invoice as Invoice;
}

export async function createInvoiceItems(
    items: Omit<InvoiceItem, 'id' | 'created_at'>[]
): Promise<InvoiceItem[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoice_items')
        .insert(items)
        .select();

    if (error) {
        console.error('[InvoicesDao] Error creating invoice items:', error);
        return [];
    }

    return data as InvoiceItem[];
}

export async function getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices')
        .select(`
      *,
      items:invoice_items(*)
    `)
        .eq('invoice_number', invoiceNumber)
        .single();

    if (error) {
        console.error('[InvoicesDao] Error fetching invoice:', error);
        return null;
    }

    return data as Invoice;
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices')
        .select(`
      *,
      items:invoice_items(*)
    `)
        .eq('id', id)
        .single();

    if (error) {
        console.error('[InvoicesDao] Error fetching invoice by ID:', error);
        return null;
    }

    return data as Invoice;
}

export async function listInvoices(filters: InvoiceFilters): Promise<InvoiceListResult> {
    const supabase = getSupabaseAdmin();
    const { month, year, status, search, page = 1, limit = 20 } = filters;

    let query = supabase
        .from('invoices')
        .select('*, items:invoice_items(*)', { count: 'exact' });

    if (month) {
        query = query.eq('period_month', month);
    }

    if (year) {
        query = query.eq('period_year', year);
    }

    if (status) {
        query = query.eq('status', status);
    }

    if (search) {
        query = query.or(`invoice_number.ilike.%${search}%,parent_name.ilike.%${search}%`);
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error('[InvoicesDao] Error listing invoices:', error);
        return { invoices: [], total: 0, page, limit };
    }

    return {
        invoices: data as Invoice[],
        total: count || 0,
        page,
        limit
    };
}

export async function getPendingInvoicesForMonth(
    month: number,
    year: number
): Promise<Invoice[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices')
        .select('*, items:invoice_items(*)')
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('status', 'PENDING');

    if (error) {
        console.error('[InvoicesDao] Error fetching pending invoices:', error);
        return [];
    }

    return data as Invoice[];
}

export async function invoiceExistsForParent(
    parentPhone: string,
    month: number,
    year: number
): Promise<boolean> {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .from('invoices')
        .select('id')
        .eq('parent_phone', parentPhone)
        .eq('period_month', month)
        .eq('period_year', year)
        .limit(1);

    return (data?.length || 0) > 0;
}

export async function markInvoiceAsPaid(
    id: string,
    paidAt: string,
    paidNotes?: string
): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices')
        .update({
            status: 'PAID' as InvoiceStatus,
            paid_at: paidAt,
            paid_notes: paidNotes || null
        })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error marking invoice as paid:', error);
        return null;
    }

    return data as Invoice;
}

export async function updateInvoiceStatus(
    id: string,
    status: InvoiceStatus
): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error updating invoice status:', error);
        return null;
    }

    return data as Invoice;
}

export async function getInvoiceHistoryByParent(parentPhone: string): Promise<Invoice[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices')
        .select('*, items:invoice_items(*)')
        .eq('parent_phone', parentPhone)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

    if (error) {
        console.error('[InvoicesDao] Error fetching invoice history:', error);
        return [];
    }

    return data as Invoice[];
}

// ============================================================================
// WhatsApp Sessions
// ============================================================================

export async function getWhatsAppSession(clientId: string) {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .from('whatsapp_sessions')
        .select('*')
        .eq('client_id', clientId)
        .single();

    return data;
}

export async function upsertWhatsAppSession(
    clientId: string,
    data: {
        is_connected?: boolean;
        connected_phone?: string | null;
        session_data?: Record<string, unknown>;
        last_activity_at?: string;
    }
) {
    const supabase = getSupabaseAdmin();

    const { data: result, error } = await supabase
        .from('whatsapp_sessions')
        .upsert({
            client_id: clientId,
            ...data
        }, { onConflict: 'client_id' })
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error upserting WA session:', error);
        return null;
    }

    return result;
}
