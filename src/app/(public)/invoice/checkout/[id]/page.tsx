import { notFound } from 'next/navigation';
import { authorizeCheckout, publicCheckoutData } from '@/lib/services/invoiceCheckoutServer';
import InvoiceCheckoutView from './InvoiceCheckoutView';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Pilih Tagihan • Clevio', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default async function InvoiceCheckoutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string }> }) {
  const id = (await params).id, token = (await searchParams).t;
  try {
    const { link, invoices } = await authorizeCheckout(id, typeof token === 'string' ? token : null);
    return <InvoiceCheckoutView id={id} token={token!} initialData={await publicCheckoutData(link, invoices, token!)} />;
  } catch { notFound(); }
}
