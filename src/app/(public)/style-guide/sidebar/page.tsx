"use client";

import { SidebarDemo } from '@/components/ui/demo';

export default function SidebarGuidePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-10 dark:bg-neutral-900">
      <div className="px-4">
        <h1 className="mb-6 text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
          Sidebar Component Preview
        </h1>
        <p className="mb-8 max-w-2xl text-sm text-neutral-600 dark:text-neutral-300">
          Komponen ini mencontohkan sidebar responsif yang memanfaatkan shadcn-style utilities, Tailwind CSS,
          framer-motion, dan ikon dari lucide-react. Gunakan struktur ini ketika ingin menempatkan navigasi utama
          di dashboard LMS.
        </p>
        <SidebarDemo />
      </div>
    </div>
  );
}
