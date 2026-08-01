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
    getMonthlyInvoiceForParent,
    updateInvoiceSummary
} from '@/lib/dao/invoicesDao';
import type { GenerateInvoicesResponse, Invoice, InvoiceItem } from '@/lib/types/invoice';

interface CoderPaymentData {
    id: string;
    coder_id: string;
    class_id: string | null;
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

        // 2. Validate that we're not generating for future months
        const now = new Date();
        const currentMonth = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();

        // Check if target month is in the future
        if (year > currentYear || (year === currentYear && month > currentMonth)) {
            result.success = false;
            result.errors.push(`Tidak dapat generate invoice untuk bulan depan. Bulan target (${month}/${year}) belum tiba.`);
            return result;
        }

        // 3. Fetch payment periods that NEED TO BE RENEWED in this month
        // Logic: Generate invoice for periods whose end_date falls in the target month
        // This means their current payment is expiring and they need to pay for the next period
        const startDate = new Date(year, month - 1, 1).toISOString();
        const endDate = new Date(year, month, 0).toISOString();

        console.log(`[InvoiceGenerator] Generating for ${month}/${year}`);
        console.log(`[InvoiceGenerator] Looking for periods ending between: ${startDate} to ${endDate}`);

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
            // NEW Logic: Periods that END within this month (need renewal)
            // end_date >= first day of month AND end_date <= last day of month
            .gte('end_date', startDate)
            .lte('end_date', endDate);

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

        const activeEnrollmentKeys = await getActiveEnrollmentKeys(supabase, periods as unknown as CoderPaymentData[]);
        const invoiceablePeriods = (periods as unknown as CoderPaymentData[]).filter((period) => {
            if (!period.class_id) return false;
            return activeEnrollmentKeys.has(getEnrollmentKey(period.coder_id, period.class_id));
        });
        const skippedWithoutEnrollment = periods.length - invoiceablePeriods.length;
        if (skippedWithoutEnrollment > 0) {
            console.log(`[InvoiceGenerator] Skipping ${skippedWithoutEnrollment} periods without active class enrollment`);
        }

        if (invoiceablePeriods.length === 0) {
            result.errors.push('No invoiceable active payment periods found for this month.');
            return result;
        }

        // 3. Group by parent phone
        const parentGroups = groupByParentPhone(invoiceablePeriods);
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

                // Track period dates across all coders
                let invoiceStartDate: Date | null = null;
                let invoiceEndDate: Date | null = null;

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

                    // Calculate period dates for this coder
                    // FIXED: Always start from the 26th of the billing month (month, year)
                    const itemStartDate = new Date(year, month - 1, 26);

                    // Calculate end date based on duration (e.g., 25th of next month)
                    const itemEndDate = new Date(itemStartDate);
                    itemEndDate.setMonth(itemEndDate.getMonth() + duration);
                    itemEndDate.setDate(itemEndDate.getDate() - 1);

                    // Track earliest start and latest end for the invoice
                    if (!invoiceStartDate || itemStartDate < invoiceStartDate) {
                        invoiceStartDate = itemStartDate;
                    }
                    if (!invoiceEndDate || itemEndDate > invoiceEndDate) {
                        invoiceEndDate = itemEndDate;
                    }

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

                // If no valid items (all EKSKUL), skip this invoice
                if (items.length === 0) {
                    console.log(`[InvoiceGenerator] No valid items for ${group.parentName}, skipping`);
                    result.skipped++;
                    continue;
                }

                // Ensure we have period dates (fallback to month if somehow null)
                if (!invoiceStartDate || !invoiceEndDate) {
                    console.warn(`[InvoiceGenerator] Missing period dates for ${group.parentName}, using month defaults`);
                    invoiceStartDate = new Date(year, month - 1, 1);
                    invoiceEndDate = new Date(year, month, 0);
                }

                // Calculate due date
                const dueDate = calculateDueDate(settings.generate_day, settings.due_days, month, year);

                // Determine final parent name:
                // 1. Use existing CCR parent name if set (allows manual override in DB)
                // 2. Fallback to generated group name ("Orang Tua dari...")
                const finalParentName = ccr.parent_name || group.parentName;

                const periodStartDate = invoiceStartDate.toISOString().split('T')[0];
                const periodEndDate = invoiceEndDate.toISOString().split('T')[0];
                const existingInvoice = await getMonthlyInvoiceForParent(group.parentPhone, month, year);

                if (existingInvoice) {
                    const existingItems = existingInvoice.items ?? [];
                    const existingPeriodIds = new Set(
                        existingItems
                            .map((item) => item.payment_period_id)
                            .filter((id): id is string => Boolean(id))
                    );
                    const itemsToCreate = items.filter((item) => {
                        return !item.payment_period_id || !existingPeriodIds.has(item.payment_period_id);
                    });

                    if (itemsToCreate.length === 0) {
                        console.log(`[InvoiceGenerator] Invoice already has all items for ${group.parentName}`);
                        result.skipped++;
                        continue;
                    }

                    if (existingInvoice.status === 'PAID') {
                        console.warn(`[InvoiceGenerator] Cannot add missing items to paid invoice ${existingInvoice.invoice_number}`);
                        result.skipped++;
                        result.errors.push(`Skipped: Invoice ${existingInvoice.invoice_number} is already PAID but has missing items for ${group.parentName}`);
                        continue;
                    }

                    const invoiceItems = await createInvoiceItems(
                        itemsToCreate.map(item => ({ ...item, invoice_id: existingInvoice.id }))
                    );

                    if (invoiceItems.length === 0) {
                        result.errors.push(`Failed to add missing invoice items for ${group.parentName}`);
                        continue;
                    }

                    if (invoiceItems.length !== itemsToCreate.length) {
                        result.errors.push(`Partial update: only added ${invoiceItems.length}/${itemsToCreate.length} missing items for ${group.parentName}`);
                    }

                    const addedAmount = invoiceItems.reduce((sum, item) => sum + item.final_price, 0);
                    const existingStartDate = existingInvoice.period_start_date ? new Date(existingInvoice.period_start_date) : invoiceStartDate;
                    const existingEndDate = existingInvoice.period_end_date ? new Date(existingInvoice.period_end_date) : invoiceEndDate;
                    const mergedStartDate = existingStartDate < invoiceStartDate ? existingStartDate : invoiceStartDate;
                    const mergedEndDate = existingEndDate > invoiceEndDate ? existingEndDate : invoiceEndDate;

                    const updatedInvoice = await updateInvoiceSummary(existingInvoice.id, {
                        total_amount: existingInvoice.total_amount + addedAmount,
                        period_start_date: mergedStartDate.toISOString().split('T')[0],
                        period_end_date: mergedEndDate.toISOString().split('T')[0]
                    });

                    if (!updatedInvoice) {
                        result.errors.push(`Failed to update invoice total for ${group.parentName}`);
                        continue;
                    }

                    result.generated++;
                    result.invoices.push({
                        ...updatedInvoice,
                        items: [...existingItems, ...(invoiceItems as InvoiceItem[])]
                    });
                    continue;
                }

                // Create invoice with period dates
                const invoice = await createInvoice({
                    ccr_id: ccr.id,
                    ccr_code: ccr.ccr_code || `CCR${String(ccr.ccr_sequence).padStart(3, '0')}`,
                    parent_phone: group.parentPhone,
                    parent_name: finalParentName,
                    period_month: month,
                    period_year: year,
                    period_start_date: periodStartDate,
                    period_end_date: periodEndDate,
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

function getEnrollmentKey(coderId: string, classId: string): string {
    return `${coderId}:${classId}`;
}

async function getActiveEnrollmentKeys(
    supabase: ReturnType<typeof getSupabaseAdmin>,
    periods: CoderPaymentData[]
): Promise<Set<string>> {
    const classPeriods = periods.filter((period) => period.class_id);
    if (classPeriods.length === 0) {
        return new Set();
    }

    const coderIds = Array.from(new Set(classPeriods.map((period) => period.coder_id)));
    const classIds = Array.from(new Set(classPeriods.map((period) => period.class_id as string)));

    const { data, error } = await supabase
        .from('enrollments')
        .select('coder_id, class_id')
        .in('coder_id', coderIds)
        .in('class_id', classIds)
        .eq('status', 'ACTIVE');

    if (error) {
        throw new Error(`Failed to check active enrollments: ${error.message}`);
    }

    return new Set((data ?? []).map((enrollment) => getEnrollmentKey(enrollment.coder_id, enrollment.class_id)));
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
export async function getInvoiceStats(month?: number, year?: number) {
    const supabase = getSupabaseAdmin();

    let queryPending = supabase.from('invoices' as any).select('*', { count: 'exact', head: true }).eq('status', 'PENDING');
    let queryPaid = supabase.from('invoices' as any).select('*', { count: 'exact', head: true }).eq('status', 'PAID');
    let queryOverdue = supabase.from('invoices' as any).select('*', { count: 'exact', head: true }).eq('status', 'OVERDUE');
    let queryTotal = supabase.from('invoices' as any).select('total_amount').neq('status', 'PAID');

    if (month) {
        queryPending = queryPending.eq('period_month', month);
        queryPaid = queryPaid.eq('period_month', month);
        queryOverdue = queryOverdue.eq('period_month', month);
        queryTotal = queryTotal.eq('period_month', month);
    }
    
    if (year) {
        queryPending = queryPending.eq('period_year', year);
        queryPaid = queryPaid.eq('period_year', year);
        queryOverdue = queryOverdue.eq('period_year', year);
        queryTotal = queryTotal.eq('period_year', year);
    }

    const [pending, paid, overdue, total] = await Promise.all([
        queryPending,
        queryPaid,
        queryOverdue,
        queryTotal
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
