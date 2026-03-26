export const revalidate = 0;

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import QuestionsClient from './QuestionsClient';

export default async function AdminEvaluationQuestionsPage() {
  const supabase = getSupabaseAdmin();

  // Fetch all templates with their level names
  const { data: templates } = await supabase
    .from('block_evaluation_templates')
    .select(`
      *,
      level:levels(name)
    `)
    .order('created_at', { ascending: false });

  // Fetch all levels for the dropdown
  const { data: levels } = await supabase
    .from('levels')
    .select('id, name')
    .order('order_index', { ascending: true });

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Pertanyaan Refleksi</h1>
        <p className="text-slate-500 max-w-3xl text-base leading-relaxed">
          Kelola pertanyaan refleksi evaluasi pada rapor kompetensi, disesuaikan berdasarkan Level / Kelas.
        </p>
      </header>

      <QuestionsClient initialData={templates || []} levels={levels || []} />
    </div>
  );
}
