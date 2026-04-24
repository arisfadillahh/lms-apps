export const revalidate = 0;

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import QuestionsClient from './QuestionsClient';
import PageHead from '@/components/admin/PageHead';

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
      <PageHead
        title="Pertanyaan Refleksi"
        desc="Kurasi pertanyaan refleksi yang muncul di rapor agar konsisten lintas level."
      />

      <QuestionsClient initialData={templates || []} levels={levels || []} />
    </div>
  );
}
