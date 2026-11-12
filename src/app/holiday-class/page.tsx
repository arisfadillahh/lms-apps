import type { Metadata } from 'next';
import HolidayPreview from './HolidayPreview';
export const metadata: Metadata = {
  title: 'Holiday Class 2026–2027 | Clevio',
  robots: { index: false, follow: false },
};
export default function HolidayClassPage() { return <HolidayPreview />; }
