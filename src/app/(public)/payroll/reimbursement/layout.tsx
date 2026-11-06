import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Reimbursement · Clevio',
  description: 'Pengajuan penggantian pengeluaran Clevio.',
  referrer: 'no-referrer',
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false, noimageindex: true } },
};

export default function ReimbursementLayout({ children }: { children: React.ReactNode }) {
  return <div lang="id">{children}</div>;
}
