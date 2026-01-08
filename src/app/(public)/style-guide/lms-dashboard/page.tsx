"use client";

import { LmsDashboardShowcase } from '@/components/demo/LmsDashboard';

export default function LmsDashboardShowcasePage() {
  return (
    <div className="min-h-screen bg-background">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 py-10">
        <header className="space-y-2 px-4">
          <h1 className="text-2xl font-semibold text-foreground">Component Bundle Showcase</h1>
          <p className="text-sm text-muted-foreground">
            Halaman ini memamerkan bundle UI lengkap (Tailwind 4 + shadcn style) sebagaimana contoh app asli. Gunakan
            referensi ini saat memigrasikan dashboard utama tanpa mengubah fitur back-end.
          </p>
        </header>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <LmsDashboardShowcase />
        </div>
      </section>
    </div>
  );
}
