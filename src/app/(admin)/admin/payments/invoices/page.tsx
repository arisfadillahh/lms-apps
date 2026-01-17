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
    const { data: invoices } = await supabase
        .from('invoices')
        .select('*, items:invoice_items(*)')
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear)
        .order('created_at', { ascending: false })
        .limit(50);

    // Get stats
    const { data: stats } = await supabase
        .from('invoices')
        .select('status, total_amount')
        .eq('period_month', currentMonth)
        .eq('period_year', currentYear);

    const pendingCount = stats?.filter(i => i.status === 'PENDING').length || 0;
    const paidCount = stats?.filter(i => i.status === 'PAID').length || 0;
    const overdueCount = stats?.filter(i => i.status === 'OVERDUE').length || 0;
    const totalAmount = stats?.reduce((sum, i) => sum + (i.total_amount || 0), 0) || 0;

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
