import { fromZonedTime } from 'date-fns-tz';
import type { InvoiceFilters } from './types/invoice';

export const INVOICE_TIME_ZONE = 'Asia/Jakarta';
type Filters = Pick<InvoiceFilters, 'dateBasis' | 'month' | 'year' | 'search'>;

export function invoiceDateRange(year: number, month?: number) {
    const monthStart = (y: number, m: number) =>
        fromZonedTime(`${y}-${String(m).padStart(2, '0')}-01T00:00:00`, INVOICE_TIME_ZONE).toISOString();

    return {
        start: monthStart(year, month ?? 1),
        end: !month || month === 12 ? monthStart(year + 1, 1) : monthStart(year, month + 1)
    };
}

export function applyInvoiceFilters<Q extends {
    eq(column: string, value: string | number): Q;
    not(column: string, operator: string, value: null): Q;
    gte(column: string, value: string): Q;
    lt(column: string, value: string): Q;
    or(filters: string): Q;
}>(query: Q, { dateBasis = 'period', month, year, search }: Filters): Q {
    if (dateBasis === 'period') {
        if (month) query = query.eq('period_month', month);
        if (year) query = query.eq('period_year', year);
    } else {
        if (dateBasis === 'paid') query = query.eq('status', 'PAID').not('paid_at', 'is', null);
        if (year) {
            const { start, end } = invoiceDateRange(year, month);
            const column = dateBasis === 'paid' ? 'paid_at' : 'created_at';
            query = query.gte(column, start).lt(column, end);
        }
    }

    if (search) {
        const pattern = `"%${search.replace(/[\\"]/g, '\\$&')}%"`;
        query = query.or(`invoice_number.ilike.${pattern},parent_name.ilike.${pattern}`);
    }
    return query;
}
