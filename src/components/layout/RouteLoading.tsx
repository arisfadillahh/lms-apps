type RouteLoadingProps = {
  title?: string;
  description?: string;
};

export default function RouteLoading({
  title = 'Memuat halaman',
  description = 'Data sedang disiapkan.',
}: RouteLoadingProps) {
  return (
    <main
      className="min-h-[60vh] w-full px-4 py-10"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
        <div className="flex items-center gap-3">
          <span className="h-5 w-5 rounded-full border-2 border-slate-200 border-t-[#00b0d7] animate-spin" />
          <div>
            <div className="text-sm font-black text-slate-800">{title}</div>
            <div className="text-xs font-semibold text-slate-500">{description}</div>
          </div>
        </div>

        <div className="h-24 rounded-lg bg-slate-100 animate-pulse" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
          <div className="h-28 rounded-lg bg-slate-100 animate-pulse" />
        </div>
        <div className="h-52 rounded-lg bg-slate-100 animate-pulse" />
      </div>
    </main>
  );
}
