/**
 * Admin Invoice Management Page
 * Route: /admin/payments/invoices
 * 
 * Table list of invoices with filters, search, and actions.
 */

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import InvoiceManagement from './InvoiceManagement';

export default async function AdminInvoicesPage() {
    const supabase = getSupabaseAdmin();

    // Get current month/year
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Fetch initial data
    const { data: invoicesData } = await supabase
        .from('invoices' as any)
        .select('*, items:invoice_items(*)')
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .order('created_at', { ascending: false })
        .limit(50);

    const invoices = invoicesData as any[] || [];

    // Get stats
    const { data: statsData } = await supabase
        .from('invoices' as any)
        .select('status, total_amount')
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear);

    const stats = statsData as any[] || [];

    const pendingCount = stats.filter((i: any) => i.status === 'PENDING').length || 0;
    const paidCount = stats.filter((i: any) => i.status === 'PAID').length || 0;
    const overdueCount = stats.filter((i: any) => i.status === 'OVERDUE').length || 0;
    const totalAmount = stats.reduce((sum: number, i: any) => sum + (i.total_amount || 0), 0) || 0;

    return (
        <InvoiceManagement
            initialInvoices={invoices || []}
            initialStats={{
                pending: pendingCount,
                paid: paidCount,
                overdue: overdueCount,
                totalAmount
            }}
            initialMonth={currentMonth}
            initialYear={currentYear}
        />
    );
}

export const metadata = {
    title: 'Invoice Management - Admin',
    description: 'Manage invoices and send payment reminders'
};
