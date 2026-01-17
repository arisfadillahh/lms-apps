/**
 * Invoice Generator Service
 * 
 * Business logic for generating invoices from active payment periods.
 * Groups coders by parent phone to create combined invoices.
 */

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import {
    getOrCreateCCR,
    createInvoice,
    createInvoiceItems,
    getInvoiceSettings,
    invoiceExistsForParent
} from '@/lib/dao/invoicesDao';
import type { GenerateInvoicesResponse, Invoice, InvoiceItem } from '@/lib/types/invoice';

interface CoderPaymentData {
    id: string;
    coder_id: string;
    class_id: string;
    total_amount: number;
    start_date: string;
    end_date: string;
    status: string;
    users: {
        id: string;
        full_name: string;
        parent_contact_phone: string | null;
    } | null;
    classes: {
        id: string;
        name: string;
        type: string;
        level_id: string | null;
        levels: {
            id: string;
            name: string;
        } | null;
    } | null;
    payment_plans: {
        id: string;
        name: string;
        discount_percent: number;
        duration_months: number;
    } | null;
    pricing: {
        id: string;
        base_price_monthly: number;
    } | null;
}

interface ParentGroup {
    parentPhone: string;
    parentName: string;
    coders: CoderPaymentData[];
}

/**
 * Generate invoices for a specific month/year
 * Groups coders by parent phone to create combined invoices
 */
export async function generateInvoicesForMonth(
    month: number,
    year: number
): Promise<GenerateInvoicesResponse> {
    const result: GenerateInvoicesResponse = {
        success: true,
        generated: 0,
        skipped: 0,
        invoices: [],
        errors: []
    };

    try {
        // 1. Get settings for due date calculation
        const settings = await getInvoiceSettings();
        if (!settings) {
            result.success = false;
            result.errors.push('Invoice settings not found. Please configure settings first.');
            return result;
        }

        // 2. Fetch all active payment periods that end in the target month/year (for renewal)
        // OR periods specifically tagged for this month (if month/year columns exist)
        // For now, assuming renewal logic: Invoice is for the UPCOMING period, generated when current encounters.
        // User asked: "di invoice itu ketika klik generate apakah hanya bikin yang perlu di invoice dibulan itu?"
        // Answer: Yes, we should filter.

        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0).toISOString();

        console.log(`[InvoiceGenerator] Generating for ${month}/${year}`);
        console.log(`[InvoiceGenerator] Window: ${startDate} to ${endDate}`);

        const supabase = getSupabaseAdmin();
        const { data: periods, error } = await supabase
            .from('coder_payment_periods' as any)
            .select(`
        *,
        users!coder_payment_periods_coder_id_fkey(id, full_name, parent_contact_phone, parent_name),
        classes(id, name, level_id, type, levels(id, name)),
        payment_plans(*),
        pricing(*)
      `)
            .eq('status', 'ACTIVE')
            // Filter: Active periods that OVERLAP with the current month
            // 1. Started before or during this month
            .lte('start_date', endDate)
            // 2. Ends after this month starts (is still active in this month)
            .gte('end_date', startDate);

        if (error) {
            console.error('[InvoiceGenerator] Query error:', error);
            result.success = false;
            result.errors.push(`Database error: ${error.message}`);
            return result;
        }

        console.log(`[InvoiceGenerator] Found ${periods?.length || 0} matching periods`);

        if (!periods || periods.length === 0) {
            result.errors.push('No active payment periods found for this month.');
            return result;
        }

        // 3. Group by parent phone
        const parentGroups = groupByParentPhone(periods as unknown as CoderPaymentData[]);
        console.log(`[InvoiceGenerator] Grouped into ${parentGroups.length} parent groups`);

        // 4. Generate invoice for each parent group
        for (const group of parentGroups) {
            try {
                // Skip if no valid phone
                if (!group.parentPhone) {
                    console.warn(`[InvoiceGenerator] Skipping group ${group.parentName} - No phone`);
                    result.skipped++;
                    result.errors.push(`Skipped: No parent phone for ${group.parentName}`);
                    continue;
                }

                // Check if invoice already exists for this parent/month
                const exists = await invoiceExistsForParent(group.parentPhone, month, year);
                if (exists) {
                    console.log(`[InvoiceGenerator] Invoice exists for ${group.parentName}`);
                    result.skipped++;
                    continue;
                }

                // Get or create CCR number
                const ccr = await getOrCreateCCR(group.parentPhone, group.parentName);
                if (!ccr) {
                    console.error(`[InvoiceGenerator] Failed Get/Create CCR for ${group.parentName}`);
                    result.errors.push(`Failed to create CCR for ${group.parentName}`);
                    continue;
                }

                // Calculate total and prepare items
                let totalAmount = 0;
                const items: Omit<InvoiceItem, 'id' | 'created_at' | 'invoice_id'>[] = [];

                for (const coder of group.coders) {
                    // Skip 'EKSKUL' classes as they are paid via school (external)
                    if (coder.classes?.type === 'EKSKUL') {
                        console.log(`[InvoiceGenerator] Skipping EKSKUL class: ${coder.classes.name}`);
                        continue;
                    }

                    const duration = coder.payment_plans?.duration_months || 1;
                    const monthlyPrice = coder.pricing?.base_price_monthly || 0;

                    // Base Price = Monthly * Duration
                    // If no pricing linked, fallback to stored total_amount (assuming it's already final, so base=final)
                    const basePrice = monthlyPrice > 0 ? (monthlyPrice * duration) : coder.total_amount;

                    const discountPercent = coder.payment_plans?.discount_percent || 0;
                    const discountAmount = Math.floor(basePrice * (discountPercent / 100));
                    const finalPrice = basePrice - discountAmount;

                    items.push({
                        coder_id: coder.coder_id,
                        coder_name: coder.users?.full_name || 'Unknown',
                        class_name: coder.classes?.name || 'Unknown Class',
                        level_name: coder.classes?.levels?.name || 'Unknown Level',
                        base_price: basePrice,
                        discount_amount: discountAmount,
                        final_price: finalPrice,
                        payment_period_id: coder.id
                    });

                    totalAmount += finalPrice;
                }

                // Calculate due date
                const dueDate = calculateDueDate(settings.generate_day, settings.due_days, month, year);

                // Determine final parent name:
                // 1. Use existing CCR parent name if set (allows manual override in DB)
                // 2. Fallback to generated group name ("Orang Tua dari...")
                const finalParentName = ccr.parent_name || group.parentName;

                // Create invoice
                const invoice = await createInvoice({
                    ccr_id: ccr.id,
                    ccr_code: ccr.ccr_code || `CCR${String(ccr.ccr_sequence).padStart(3, '0')}`,
                    parent_phone: group.parentPhone,
                    parent_name: finalParentName,
                    period_month: month,
                    period_year: year,
                    total_amount: totalAmount,
                    due_date: dueDate
                });

                if (!invoice) {
                    result.errors.push(`Failed to create invoice for ${group.parentName}`);
                    continue;
                }

                // Create invoice items
                const invoiceItems = await createInvoiceItems(
                    items.map(item => ({ ...item, invoice_id: invoice.id }))
                );

                // Add to result
                result.generated++;
                result.invoices.push({
                    ...invoice,
                    items: invoiceItems as InvoiceItem[]
                });

            } catch (err) {
                result.errors.push(`Error processing ${group.parentName}: ${String(err)}`);
            }
        }

        return result;

    } catch (err) {
        result.success = false;
        result.errors.push(`Unexpected error: ${String(err)}`);
        return result;
    }
}

/**
 * Group payment periods by parent phone
 */
function groupByParentPhone(periods: CoderPaymentData[]): ParentGroup[] {
    const groups = new Map<string, ParentGroup>();

    for (const period of periods) {
        const phone = period.users?.parent_contact_phone;
        if (!phone) continue;

        if (!groups.has(phone)) {
            const coderName = period.users?.full_name || 'Unknown';
            groups.set(phone, {
                parentPhone: phone,
                // Default to "Orang Tua dari [Name]" to identify them correctly
                // Admin can update the CCR record to set the real name
                parentName: `Orang Tua dari ${coderName}`,
                coders: []
            });
        }

        groups.get(phone)!.coders.push(period);
    }

    return Array.from(groups.values());
}

/**
 * Calculate due date based on settings
 */
function calculateDueDate(
    generateDay: number,
    dueDays: number,
    month: number,
    year: number
): string {
    // Start from generate day of the month
    const baseDate = new Date(year, month - 1, generateDay);
    // Add due days
    baseDate.setDate(baseDate.getDate() + dueDays);

    return baseDate.toISOString().split('T')[0];
}

/**
 * Get invoice statistics for current month
 */
export async function getInvoiceStats(month: number, year: number) {
    const supabase = getSupabaseAdmin();

    const [pending, paid, overdue, total] = await Promise.all([
        supabase.from('invoices' as any).select('*', { count: 'exact', head: true })
            .eq('period_month', month).eq('period_year', year).eq('status', 'PENDING'),
        supabase.from('invoices' as any).select('*', { count: 'exact', head: true })
            .eq('period_month', month).eq('period_year', year).eq('status', 'PAID'),
        supabase.from('invoices' as any).select('*', { count: 'exact', head: true })
            .eq('period_month', month).eq('period_year', year).eq('status', 'OVERDUE'),
        supabase.from('invoices' as any).select('total_amount')
            .eq('period_month', month).eq('period_year', year)
    ]);

    const totalAmount = ((total.data as any[]) || []).reduce(
        (sum, inv) => sum + (inv.total_amount || 0),
        0
    );

    return {
        pending: pending.count || 0,
        paid: paid.count || 0,
        overdue: overdue.count || 0,
        totalAmount
    };
}
