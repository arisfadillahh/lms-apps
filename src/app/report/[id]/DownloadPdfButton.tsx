'use client';

import { Download } from 'lucide-react';

export default function DownloadPdfButton() {
  const handleDownload = () => {
    // A simple window.print() triggers the browser's PDF print dialog.
    // CSS @media print handles the styling to make it look good on paper.
    window.print();
  };

  return (
    <button 
      onClick={handleDownload}
      className="w-full sm:w-auto flex items-center justify-center gap-3 px-8 py-4 bg-white border-2 border-clevio-navy text-clevio-navy font-bold rounded-2xl hover:bg-slate-50 transition-all active:scale-95 shadow-lg print:hidden"
    >
      <Download size={18} />
      Download PDF
    </button>
  );
}
