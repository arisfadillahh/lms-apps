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
import { buildInvoicePublicUrl } from '@/lib/services/invoicePublicAccess';

function resolveInvoicePublicBaseUrl(settings?: InvoiceSettings | null): string {
    return settings?.base_url?.trim()
        || process.env.NEXT_PUBLIC_APP_URL?.trim()
        || process.env.NEXT_PUBLIC_BASE_URL?.trim()
        || process.env.NEXTAUTH_URL?.trim()
        || 'https://lms.clev.io';
}

// ============================================================================
// Invoice Settings
// ============================================================================

export async function getInvoiceSettings(): Promise<InvoiceSettings | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoice_settings' as any)
        .select('*')
        .limit(1)
        .single();

    if (error) {
        console.error('[InvoicesDao] Error fetching settings:', error);
        return null;
    }

    return (data as unknown) as InvoiceSettings;
}

export async function updateInvoiceSettings(
    settings: Partial<Omit<InvoiceSettings, 'id' | 'updated_at'>>
): Promise<InvoiceSettings | null> {
    const supabase = getSupabaseAdmin();

    // Get the existing settings ID first
    const { data: existing } = await supabase
        .from('invoice_settings' as any)
        .select('id')
        .limit(1)
        .single();

    if (!existing) {
        console.error('[InvoicesDao] No settings record found');
        return null;
    }

    const { data, error } = await supabase
        .from('invoice_settings' as any)
        .update(settings)
        .eq('id', (existing as any).id)
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error updating settings:', error);
        return null;
    }

    return (data as unknown) as InvoiceSettings;
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
        .from('ccr_numbers' as any)
        .select('*')
        .eq('parent_phone', parentPhone)
        .single();

    if (existing) {
        return (existing as unknown) as CCRNumber;
    }

    // Get next sequence number by finding MAX existing sequence
    const { data: maxResult } = await supabase
        .from('ccr_numbers' as any)
        .select('ccr_sequence')
        .order('ccr_sequence', { ascending: false })
        .limit(1)
        .single();

    const currentMax = maxResult ? (maxResult as any).ccr_sequence : 0;
    const nextSeq = currentMax + 1;
    const nextCode = formatCCRCode(nextSeq);

    // Create new CCR
    const { data: newCCR, error } = await supabase
        .from('ccr_numbers' as any)
        .insert({
            parent_phone: parentPhone,
            ccr_sequence: nextSeq,
            ccr_code: nextCode,
            parent_name: parentName || null
        })
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error creating CCR:', error);
        return null;
    }

    return (newCCR as unknown) as CCRNumber;
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

    const { data } = await (supabase as any)
        .rpc('get_next_ccr_code');

    return data || 'CCR001';
}

export async function getCCRByPhone(parentPhone: string): Promise<CCRNumber | null> {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .from('ccr_numbers' as any)
        .select('*')
        .eq('parent_phone', parentPhone)
        .single();

    return (data as unknown) as CCRNumber | null;
}

export async function getCCRByCode(ccrCode: string): Promise<CCRNumber | null> {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .from('ccr_numbers' as any)
        .select('*')
        .eq('ccr_code', ccrCode)
        .single();

    return (data as unknown) as CCRNumber | null;
}

export async function assignCCRToParent(
    parentPhone: string,
    ccrCode: string,
    parentName?: string
): Promise<CCRNumber | null> {
    const supabase = getSupabaseAdmin();
    const normalizedCode = ccrCode.trim().toUpperCase();

    // Validate CCR code format
    if (!/^CCR[0-9]{3,}$/.test(normalizedCode)) {
        console.error('[InvoicesDao] Invalid CCR code format:', ccrCode);
        return null;
    }

    // Check if CCR code already exists
    const existingCode = await getCCRByCode(normalizedCode);
    if (existingCode && existingCode.parent_phone !== parentPhone) {
        console.error('[InvoicesDao] CCR code already assigned to different parent:', normalizedCode);
        return null;
    }

    // An existing parent record is editable from the assignment queue. The old
    // behavior returned the existing value here, so edits appeared to save but
    // reverted after the queue was refreshed.
    const existingParent = await getCCRByPhone(parentPhone);
    if (existingParent) {
        if (existingParent.ccr_code === normalizedCode && !parentName) {
            return existingParent;
        }

        const { data: updatedCCR, error: updateError } = await supabase
            .from('ccr_numbers' as any)
            .update({
                ccr_code: normalizedCode,
                ccr_sequence: parseInt(normalizedCode.substring(3), 10),
                ...(parentName?.trim() ? { parent_name: parentName.trim() } : {})
            })
            .eq('id', existingParent.id)
            .select()
            .single();

        if (updateError) {
            console.error('[InvoicesDao] Error updating assigned CCR:', updateError);
            return null;
        }

        return (updatedCCR as unknown) as CCRNumber;
    }

    // Extract sequence from CCR code
    const sequence = parseInt(normalizedCode.substring(3), 10);

    // Create new CCR
    const { data: newCCR, error } = await supabase
        .from('ccr_numbers' as any)
        .insert({
            parent_phone: parentPhone,
            ccr_sequence: sequence,
            ccr_code: normalizedCode,
            parent_name: parentName || null
        })
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error assigning CCR:', error);
        return null;
    }

    return (newCCR as unknown) as CCRNumber;
}

export async function getCodersWithoutCCR(): Promise<Array<{
    parent_phone: string;
    parent_name: string;
    existing_ccr?: string; // NEW: If parent phone already has CCR, show it here
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

    // Get all existing CCR records (phone -> ccr_code mapping)
    const { data: existingCCRs } = await supabase
        .from('ccr_numbers' as any)
        .select('parent_phone, ccr_code');

    const ccrMap = new Map<string, string>();
    for (const c of (existingCCRs as any[]) || []) {
        ccrMap.set(c.parent_phone, c.ccr_code);
    }

    // Get invoices to check which coders already have their CCR linked via invoices
    const { data: invoices } = await supabase
        .from('invoices' as any)
        .select('coder_id, ccr_id');

    const codersWithInvoice = new Set(((invoices as any[]) || []).map(inv => inv.coder_id));

    // Filter coders without CCR and group by parent phone
    const groups = new Map<string, {
        parent_phone: string;
        parent_name: string;
        existing_ccr?: string;
        db_parent_names: Set<string>;
        coders: Array<{ id: string; full_name: string; class_name?: string; level_name?: string }>;
    }>();

    for (const coder of coders) {
        const u = (coder as unknown) as typeof coder & { parent_name: string | null };
        const phone = u.parent_contact_phone;
        if (!phone) continue;

        // Skip coders who already have invoices linked (they already have CCR)
        if (codersWithInvoice.has(u.id)) continue;

        const enrollment = (u.enrollments as Array<{ classes: { name: string; levels: { name: string } | null } | null }>)?.[0];
        const className = enrollment?.classes?.name || undefined;
        const levelName = enrollment?.classes?.levels?.name || undefined;

        if (!groups.has(phone)) {
            groups.set(phone, {
                parent_phone: phone,
                parent_name: '',
                existing_ccr: ccrMap.get(phone), // Attach existing CCR if parent phone has one
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
            group.parent_name = uniqueDbNames.join(' / ');
        } else {
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
        .from('ccr_numbers' as any)
        .select('*')
        .order('ccr_sequence', { ascending: true });

    if (error) {
        console.error('[InvoicesDao] Error fetching CCRs:', error);
        return [];
    }

    return (data as unknown) as CCRNumber[];
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
    period_start_date: string;
    period_end_date: string;
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
        .from('invoices' as any)
        .insert({
            invoice_number: invoiceNumber,
            ccr_id: data.ccr_id,
            parent_phone: data.parent_phone,
            parent_name: data.parent_name,
            period_month: data.period_month,
            period_year: data.period_year,
            period_start_date: data.period_start_date,
            period_end_date: data.period_end_date,
            total_amount: data.total_amount,
            due_date: data.due_date,
            status: 'PENDING',
            invoice_type: 'MONTHLY'
        })
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error creating invoice:', error);
        return null;
    }

    return (invoice as unknown) as Invoice;
}

export async function createInvoiceItems(
    items: Omit<InvoiceItem, 'id' | 'created_at'>[]
): Promise<InvoiceItem[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoice_items' as any)
        .insert(items)
        .select();

    if (error) {
        console.error('[InvoicesDao] Error creating invoice items:', error);
        return [];
    }

    return (data as unknown) as InvoiceItem[];
}

export async function createSeasonalInvoice(data: {
    invoice_number: string;
    parent_name: string;
    parent_phone: string;
    student_phone: string;
    student_name: string;
    period_month: number;
    period_year: number;
    period_start_date: string;
    period_end_date: string;
    total_amount: number;
    due_date: string;
    items: Array<{
        class_name: string;
        level_name: string;
        description?: string;
        base_price: number;
        discount_amount: number;
        final_price: number;
    }>;
}): Promise<{ invoice: Invoice; items: InvoiceItem[] } | null> {
    const supabase = getSupabaseAdmin();

    // 1. Create Invoice
    const { data: invoice, error: invoiceError } = await supabase
        .from('invoices' as any)
        .insert({
            invoice_number: data.invoice_number,
            ccr_id: null,
            parent_phone: data.parent_phone,
            parent_name: data.parent_name,
            seasonal_student_name: data.student_name,
            seasonal_student_phone: data.student_phone,
            period_month: data.period_month,
            period_year: data.period_year,
            period_start_date: data.period_start_date,
            period_end_date: data.period_end_date,
            total_amount: data.total_amount,
            due_date: data.due_date,
            status: 'PENDING',
            invoice_type: 'SEASONAL'
        })
        .select()
        .single();

    if (invoiceError || !invoice) {
        console.error('[InvoicesDao] Error creating seasonal invoice:', invoiceError);
        return null;
    }

    // 2. Create Invoice Items
    const invoiceItemsToInsert = data.items.map(item => ({
        invoice_id: (invoice as any).id,
        coder_id: null,
        coder_name: data.student_name,
        class_name: item.class_name,
        level_name: item.level_name || '-',
        description: item.description || null,
        base_price: item.base_price,
        discount_amount: item.discount_amount,
        final_price: item.final_price,
        payment_period_id: null
    }));

    const { data: createdItems, error: itemsError } = await supabase
        .from('invoice_items' as any)
        .insert(invoiceItemsToInsert)
        .select();

    if (itemsError) {
        console.error('[InvoicesDao] Error creating seasonal invoice items:', itemsError);
    }

    return {
        invoice: (invoice as unknown) as Invoice,
        items: (createdItems as unknown) as InvoiceItem[] || []
    };
}

export async function getInvoiceByNumber(invoiceNumber: string): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices' as any)
        .select(`
      *,
      items:invoice_items(*),
      ccr_numbers(*)
    `)
        .eq('invoice_number', invoiceNumber)
        .single();

    if (data) {
        (data as any).ccr = (data as any).ccr_numbers;
    }

    if (error) {
        console.error('[InvoicesDao] Error fetching invoice:', error);
        return null;
    }

    return (data as unknown) as Invoice;
}

export async function getInvoiceById(id: string): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices' as any)
        .select(`
      *,
      items:invoice_items(*),
      ccr_numbers(*)
    `)
        .eq('id', id)
        .single();

    if (data) {
        (data as any).ccr = (data as any).ccr_numbers;
    }

    if (error) {
        console.error('[InvoicesDao] Error fetching invoice by ID:', error);
        return null;
    }

    return (data as unknown) as Invoice;
}

export async function updateExternalInvoiceMetadata(
    id: string,
    data: {
        parent_name?: string | null;
        parent_phone?: string | null;
        student_name?: string | null;
        student_phone?: string | null;
    }
): Promise<Invoice | null> {
    const existing = await getInvoiceById(id);
    if (!existing) return null;

    const supabase = getSupabaseAdmin();
    const invoicePatch: Record<string, string> = {};
    const parentName = cleanInvoiceText(data.parent_name);
    const parentPhone = cleanInvoiceText(data.parent_phone);
    const studentName = cleanInvoiceText(data.student_name);
    const studentPhone = cleanInvoiceText(data.student_phone);

    if (parentName) invoicePatch.parent_name = parentName;
    if (parentPhone) {
        invoicePatch.parent_phone = parentPhone;
        invoicePatch.seasonal_student_phone = parentPhone;
    }
    if (studentName && existing.invoice_type === 'SEASONAL') {
        invoicePatch.seasonal_student_name = studentName;
    }
    if (studentPhone && existing.invoice_type === 'SEASONAL') {
        invoicePatch.seasonal_student_phone = studentPhone;
    }

    if (Object.keys(invoicePatch).length > 0) {
        const { error } = await supabase
            .from('invoices' as any)
            .update(invoicePatch)
            .eq('id', id);

        if (error) {
            console.error('[InvoicesDao] Error updating external invoice metadata:', error);
            return null;
        }
    }

    if (studentName && existing.invoice_type === 'SEASONAL') {
        const { error } = await supabase
            .from('invoice_items' as any)
            .update({ coder_name: studentName })
            .eq('invoice_id', id)
            .is('coder_id', null);

        if (error) {
            console.error('[InvoicesDao] Error updating external invoice item metadata:', error);
            return null;
        }
    }

    return getInvoiceById(id);
}

export async function listInvoices(filters: InvoiceFilters): Promise<InvoiceListResult> {
    const supabase = getSupabaseAdmin();
    const { month, year, status, search, page = 1, limit = 20 } = filters;

    let query = supabase
        .from('invoices' as any)
        .select('*, items:invoice_items(*), ccr_numbers(*)', { count: 'exact' });

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

    const invoices = (data as unknown) as Invoice[];
    const settings = await getInvoiceSettings();
    const publicBaseUrl = resolveInvoicePublicBaseUrl(settings);

    // Map ccr_numbers to ccr
    invoices.forEach(inv => {
        if ((inv as any).ccr_numbers) {
            inv.ccr = (inv as any).ccr_numbers;
        }
        inv.public_url = buildInvoicePublicUrl(publicBaseUrl, inv);
    });

    return {
        invoices,
        total: count || 0,
        page,
        limit
    };
}

function cleanInvoiceText(value?: string | null) {
    const cleaned = String(value ?? '').trim().replace(/\s+/g, ' ');
    return cleaned || null;
}

export async function getUnpaidInvoicesForMonth(
    month: number,
    year: number
): Promise<Invoice[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices' as any)
        .select('*, items:invoice_items(*), ccr_numbers(*)')
        .eq('period_month', month)
        .eq('period_year', year)
        .in('status', ['PENDING', 'OVERDUE']);

    if (error) {
        console.error('[InvoicesDao] Error fetching pending invoices:', error);
        return [];
    }

    const invoices = (data as unknown) as Invoice[];

    // Map ccr_numbers to ccr
    invoices.forEach(inv => {
        if ((inv as any).ccr_numbers) {
            inv.ccr = (inv as any).ccr_numbers;
        }
    });

    return invoices;
}

export async function invoiceExistsForParent(
    parentPhone: string,
    month: number,
    year: number
): Promise<boolean> {
    const invoice = await getMonthlyInvoiceForParent(parentPhone, month, year);
    return Boolean(invoice);
}

export async function getMonthlyInvoiceForParent(
    parentPhone: string,
    month: number,
    year: number
): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices' as any)
        .select('*, items:invoice_items(*)')
        .eq('parent_phone', parentPhone)
        .eq('period_month', month)
        .eq('period_year', year)
        .eq('invoice_type', 'MONTHLY')
        .maybeSingle();

    if (error) {
        console.error('[InvoicesDao] Error checking monthly invoice:', error);
        return null;
    }

    return (data as unknown) as Invoice | null;
}

export async function updateInvoiceSummary(
    id: string,
    data: {
        total_amount: number;
        period_start_date: string;
        period_end_date: string;
    }
): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data: invoice, error } = await supabase
        .from('invoices' as any)
        .update(data)
        .eq('id', id)
        .select('*, items:invoice_items(*)')
        .single();

    if (error) {
        console.error('[InvoicesDao] Error updating invoice summary:', error);
        return null;
    }

    return (invoice as unknown) as Invoice;
}

export async function markInvoiceAsPaid(
    id: string,
    paidAt: string,
    paidNotes?: string
): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices' as any)
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

    return (data as unknown) as Invoice;
}

export async function updateInvoiceStatus(
    id: string,
    status: InvoiceStatus
): Promise<Invoice | null> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices' as any)
        .update({ status })
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('[InvoicesDao] Error updating invoice status:', error);
        return null;
    }

    return (data as unknown) as Invoice;
}

export async function extendPaymentPeriodsForInvoice(invoiceId: string): Promise<boolean> {
    const supabase = getSupabaseAdmin();

    try {
        // 1. Get the invoice items connected to payment periods
        const { data: items, error: itemsError } = await supabase
            .from('invoice_items' as any)
            .select('coder_id, payment_period_id')
            .eq('invoice_id', invoiceId)
            .not('payment_period_id', 'is', null);

        if (itemsError) {
            console.error('[InvoicesDao] Error fetching invoice items for extension:', itemsError);
            return false;
        }

        if (!items || items.length === 0) {
            // No payment periods associated with this invoice (e.g. pure registration or seasonal)
            return true;
        }

        // 2. Process each payment period independently
        for (const item of (items as any[])) {
            const oldPeriodId = item.payment_period_id;
            const coderId = item.coder_id;

            // Fetch the old period details
            const { data: oldPeriod, error: oldPeriodError } = await supabase
                .from('coder_payment_periods' as any)
                .select(`
                    id, 
                    class_id, 
                    payment_plan_id, 
                    pricing_id, 
                    start_date, 
                    end_date, 
                    total_amount,
                    status,
                    payment_plans(duration_months)
                `)
                .eq('id', oldPeriodId)
                .single();

            if (oldPeriodError || !oldPeriod) {
                console.error(`[InvoicesDao] Error fetching old period ${oldPeriodId}:`, oldPeriodError);
                continue;
            }

            // If it's not active anymore or duration is unknown, skip
            if ((oldPeriod as any).status !== 'ACTIVE' && (oldPeriod as any).status !== 'EXPIRED') {
                console.log(`[InvoicesDao] Skipping period ${oldPeriodId} because status is ${(oldPeriod as any).status}`);
                continue;
            }

            const durationMonths = (oldPeriod as any).payment_plans?.duration_months || 1;

            // Calculate new dates
            const oldEndDateObj = new Date((oldPeriod as any).end_date);

            // New Start Date = Old End Date + 1 Day
            const newStartDateObj = new Date(oldEndDateObj);
            newStartDateObj.setDate(newStartDateObj.getDate() + 1);

            // New End Date = New Start Date + durationMonths - 1 day
            const newEndDateObj = new Date(newStartDateObj);
            newEndDateObj.setMonth(newEndDateObj.getMonth() + durationMonths);
            newEndDateObj.setDate(newEndDateObj.getDate() - 1);

            const newStartDate = newStartDateObj.toISOString().split('T')[0];
            const newEndDate = newEndDateObj.toISOString().split('T')[0];

            console.log(`[InvoicesDao] Extending period. Old end: ${(oldPeriod as any).end_date}, New start: ${newStartDate}, New end: ${newEndDate}`);

            // Expire any existing active periods for this coder and class
            await supabase
                .from('coder_payment_periods' as any)
                .update({ status: 'EXPIRED' })
                .eq('coder_id', coderId)
                // Just to be safe, we only expire for the same class or if class_id is null
                .match({ class_id: (oldPeriod as any).class_id })
                .eq('status', 'ACTIVE');

            // Insert new active period
            const { error: insertError } = await supabase
                .from('coder_payment_periods' as any)
                .insert({
                    coder_id: coderId,
                    class_id: (oldPeriod as any).class_id,
                    payment_plan_id: (oldPeriod as any).payment_plan_id,
                    pricing_id: (oldPeriod as any).pricing_id,
                    start_date: newStartDate,
                    end_date: newEndDate,
                    total_amount: (oldPeriod as any).total_amount,
                    status: 'ACTIVE'
                });

            if (insertError) {
                console.error(`[InvoicesDao] Error inserting new extended period for coder ${coderId}:`, insertError);
                // We don't return false here to allow other items to process, but we log the error
            } else {
                console.log(`[InvoicesDao] Successfully extended period for coder ${coderId}`);
            }
        }

        return true;
    } catch (err) {
        console.error('[InvoicesDao] Exception while extending periods:', err);
        return false;
    }
}

export async function getInvoiceHistoryByParent(parentPhone: string): Promise<Invoice[]> {
    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
        .from('invoices' as any)
        .select('*, items:invoice_items(*), ccr_numbers(*)')
        .eq('parent_phone', parentPhone)
        .order('period_year', { ascending: false })
        .order('period_month', { ascending: false });

    if (error) {
        console.error('[InvoicesDao] Error fetching invoice history:', error);
        return [];
    }

    const invoices = (data as unknown) as Invoice[];

    // Map ccr_numbers to ccr
    invoices.forEach(inv => {
        if ((inv as any).ccr_numbers) {
            inv.ccr = (inv as any).ccr_numbers;
        }
    });

    return invoices;
}

// ============================================================================
// WhatsApp Sessions
// ============================================================================

export async function getWhatsAppSession(clientId: string) {
    const supabase = getSupabaseAdmin();

    const { data } = await supabase
        .from('whatsapp_sessions' as any)
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
        .from('whatsapp_sessions' as any)
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
