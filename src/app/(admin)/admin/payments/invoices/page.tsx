/**
 * Admin Invoice Management Page
 * Route: /admin/payments/invoices
 * 
 * Table list of invoices with filters, search, and actions.
 */

import { formatInTimeZone } from 'date-fns-tz';
import { listInvoices } from '@/lib/dao/invoicesDao';
import { INVOICE_TIME_ZONE } from '@/lib/invoiceDateFilter';
import { getInvoiceStats } from '@/lib/services/invoiceGenerator';
import type { InvoiceFilters } from '@/lib/types/invoice';
import InvoiceManagement from './InvoiceManagement';

export default async function AdminInvoicesPage() {
    const [currentYear, currentMonth] = formatInTimeZone(new Date(), INVOICE_TIME_ZONE, 'yyyy-MM').split('-').map(Number);
    const filters: InvoiceFilters = { dateBasis: 'issued', month: currentMonth, year: currentYear, limit: 50 };
    const [{ invoices }, stats] = await Promise.all([listInvoices(filters), getInvoiceStats(filters)]);

    return (
        <InvoiceManagement
            initialInvoices={invoices}
            initialStats={stats}
            initialMonth={currentMonth}
            initialYear={currentYear}
            checkoutEnabled={process.env.LMS_SELECTED_INVOICE_CHECKOUT_ENABLED === 'true'}
        />
    );
}

export const metadata = {
    title: 'Invoice Management - Admin',
    description: 'Manage invoices and send payment reminders'
};
