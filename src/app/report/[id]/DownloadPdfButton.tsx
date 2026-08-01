'use client';

import { Download } from 'lucide-react';

export default function DownloadPdfButton() {
  const handleDownload = () => {
    window.print();
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      title="Download PDF"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#22367b] text-sm font-bold text-white shadow-md shadow-[#22367b]/20 transition hover:bg-[#18295f] active:scale-[0.98] sm:w-auto sm:px-4 print:hidden"
    >
      <Download size={16} aria-hidden="true" />
      <span className="hidden sm:inline">Download PDF</span>
      <span className="sr-only sm:hidden">Download PDF</span>
    </button>
  );
}
