/**
 * Script used to hit OpenRouter (GPT-4o-mini)
 * Auto-generates qualitative report descriptions given raw numeric evaluation scores.
 */
import OpenAI from 'openai';

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { reportsDao, sessionsDao } from '@/lib/dao';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';

type ClassBlockWithRelations = {
  id: string;
  class_id: string;
  block_id: string;
  start_date: string;
  classes: { id: string; name: string; level_id: string | null } | { id: string; name: string; level_id: string | null }[] | null;
  blocks: { id: string; name: string | null } | { id: string; name: string | null }[] | null;
};

/**
 * AI Description Generator using openrouter
 */
async function generateBlockReportDescriptions(
  coderName: string,
  className: string,
  blockName: string,
  lessonTitlesText: string,
  criteriaInput: { criteriaId: string, criteriaName: string, score: number }[]
): Promise<{ criteriaId: string, description: string }[]> {
  type ParsedAiResponse = {
    descriptions?: Array<{
      criteriaId?: string;
      description?: string;
    }>;
  };

  // Initialize OpenAI client lazily to avoid build errors if env var is missing
  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY || 'MISSING_API_KEY', 
    defaultHeaders: {
      'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://lms.clevio.co',
      'X-Title': 'Clevio LMS',
    }
  });

  const scoringDetails = criteriaInput.map(c => `- ID: ${c.criteriaId} | Tipe: ${c.criteriaName} | Nilai: ${c.score.toFixed(1)}/10`).join('\n');

  const prompt = `
Kamu adalah Coach/Tutor coding di Clevio Coder Camp. Tugasmu adalah membuat deskripsi kualitatif per-kriteria penilaian untuk Coder bernama ${coderName}.
Kelas: ${className}
Topik Block: ${blockName}
Materi yang sudah dipelajari: ${lessonTitlesText}

Daftar Penilaian Rata-rata (Skala 1-10):
${scoringDetails}

Untuk setiap Kriteria, buatkan 1 Paragraf (2-4 kalimat) deskripsi detail dan personal tentang perkembangan coder berdasarkan skornya. 
Instruksi Penting:
- Fokus pada perkembangan positif dan saran.
- Hubungkan bahasamu dengan konteks 'Materi yang sudah dipelajari' sedapat mungkin agar terasa spesifik (Misal: "Saat mempelajari fungsi [Materi], Ananda ${coderName} sangat cepat menangkap...").
- Jangan menyebutkan angka skor secara eksplisit.
- Jika skor rendah, berikan saran/semangat singkat terkait cara belajar materi tersebut.

Keluarkan HANYA output berformat JSON yang ketat (tanpa markdown), dengan struktur:
{
  "descriptions": [
    { "criteriaId": "id-string-sesuai-di-atas", "description": "Teks paragraf..." }
  ]
}
`;
  try {
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(content) as ParsedAiResponse;
    const aiDescriptions = parsed.descriptions || [];

    // Map safely back to the known good criteria IDs to prevent AI hallucinating invalid UUIDs
    return criteriaInput.map((c, index) => {
      const matchedDesc = aiDescriptions.find((d) => d.criteriaId === c.criteriaId) || aiDescriptions[index];
      return {
        criteriaId: c.criteriaId,
        description: matchedDesc?.description || "Gagal men-generate deskripsi secara otomatis."
      };
    });
  } catch (error) {
    console.error('Failed to call OpenRouter:', error);
    return criteriaInput.map(c => ({ criteriaId: c.criteriaId, description: "Gagal menghubungi AI. Mohon isi deskripsi manual." }));
  }
}

function calculateGrade(average: number): string {
  if (average >= 8.5) return 'A';
  if (average >= 7.0) return 'B';
  if (average >= 5.5) return 'C';
  return 'D';
}

async function generateDraftReportsFromClassBlocks(
  classBlocks: ClassBlockWithRelations[],
  logPrefix: string,
): Promise<number> {
  const supabase = getSupabaseAdmin();
  const now = new Date();
  const allCriteria = await reportsDao.getEvaluationCriteria();
  const criteriaMap = new Map(allCriteria.map(c => [c.id, c.name]));

  let generatedCount = 0;

  for (const cb of classBlocks) {
    const klass = Array.isArray(cb.classes) ? cb.classes[0] : cb.classes;
    const block = Array.isArray(cb.blocks) ? cb.blocks[0] : cb.blocks;

    if (!klass || !block) continue;

    const classId = klass.id;
    const blockId = block.id;

    const [lessonMap, classSessions, classLessons] = await Promise.all([
      computeLessonSchedule(classId, klass.level_id),
      sessionsDao.listSessionsByClass(classId),
      supabase
        .from('class_lessons')
        .select('lesson:lesson_templates(title)')
        .eq('class_id', classId)
        .eq('block_id', blockId),
    ]);

    const blockSessionIds: string[] = [];
    const classSessionMap = new Map(classSessions.map(session => [session.id, session]));

    lessonMap.forEach((slot, sessionId) => {
      if (slot.block.id === blockId) {
        blockSessionIds.push(sessionId);
      }
    });

    if (blockSessionIds.length === 0) {
      console.log(`[${logPrefix}] Block ${block.name} (ID: ${blockId}) skipped: No sessions mapped to it.`);
      continue;
    }

    const blockSessions = blockSessionIds
      .map(sessionId => classSessionMap.get(sessionId))
      .filter((session): session is (typeof classSessions)[number] => session !== undefined && session.status !== 'CANCELLED');

    const lastBlockSession = blockSessions
      .sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime())[0];

    if (!lastBlockSession) {
      console.log(`[${logPrefix}] Block ${block.name} (ID: ${blockId}) skipped: No active sessions found.`);
      continue;
    }

    if (new Date(lastBlockSession.date_time).getTime() > now.getTime()) {
      console.log(
        `[${logPrefix}] Block ${block.name} (ID: ${blockId}) skipped: Last session ${lastBlockSession.id} has not passed yet (${lastBlockSession.date_time}).`,
      );
      continue;
    }

    const { data: evaluations } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .in('session_id', blockSessionIds);

    if (!evaluations || evaluations.length === 0) {
      console.log(`[${logPrefix}] Block ${block.name} (ID: ${blockId}) skipped: No evaluations exist yet.`);
      continue;
    }

    const coderScores: Record<string, Record<string, number[]>> = {};

    for (const ev of evaluations) {
      if (!coderScores[ev.coder_id]) coderScores[ev.coder_id] = {};
      if (!coderScores[ev.coder_id][ev.criteria_id]) coderScores[ev.coder_id][ev.criteria_id] = [];
      coderScores[ev.coder_id][ev.criteria_id].push(ev.score);
    }

    let lessonTitlesText = 'Materi Umum';
    if (classLessons.data && classLessons.data.length > 0) {
      const titles = classLessons.data
        .map(cl => Array.isArray(cl.lesson) ? cl.lesson[0]?.title : cl.lesson?.title)
        .filter(t => t);
      if (titles.length > 0) {
        lessonTitlesText = titles.join(', ');
      }
    }

    for (const coderId of Object.keys(coderScores)) {
      const existingReport = await reportsDao.getBlockReport(classId, blockId, coderId);
      if (existingReport && existingReport.is_ai_generated) {
        console.log(`[${logPrefix}] Skipping Coder ${coderId} in block ${blockId} because AI report already generated.`);
        continue;
      }

      if (existingReport && existingReport.status === 'PUBLISHED') {
        console.log(`[${logPrefix}] Skipping Coder ${coderId} in block ${blockId} because the report is already manually PUBLISHED.`);
        continue;
      }

      let totalSum = 0;
      let criteriaCount = 0;
      const criteriaInput: { criteriaId: string, criteriaName: string, score: number }[] = [];

      for (const [criteriaId, scores] of Object.entries(coderScores[coderId])) {
        const criteriaName = criteriaMap.get(criteriaId) || 'Kriteria Umum';
        const avgCriteriaScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        totalSum += avgCriteriaScore;
        criteriaCount++;
        criteriaInput.push({ criteriaId, criteriaName, score: avgCriteriaScore });
      }

      const globalAverage = criteriaCount > 0 ? (totalSum / criteriaCount) : 0;
      const finalGrade = calculateGrade(globalAverage);

      const { data: coderUser } = await supabase.from('users').select('full_name').eq('id', coderId).single();
      const coderName = coderUser?.full_name || 'Siswa';

      const aiDescriptions = await generateBlockReportDescriptions(
        coderName,
        klass.name,
        block.name || 'Coding',
        lessonTitlesText,
        criteriaInput,
      );

      const newReport = await reportsDao.upsertBlockReport({
        classId,
        blockId,
        coderId,
        status: 'DRAFT',
        averageScore: Number(globalAverage.toFixed(2)),
        grade: finalGrade,
        isAiGenerated: true,
      });

      const descPayload = aiDescriptions.map(d => ({
        reportId: newReport.id,
        criteriaId: d.criteriaId,
        score: criteriaInput.find(c => c.criteriaId === d.criteriaId)?.score || 0,
        description: d.description,
      }));
      await reportsDao.upsertBlockReportDescriptions(descPayload);

      generatedCount++;
    }
  }

  return generatedCount;
}

/**
 * Cron Job Logic to scan and generate draft block reports.
 * Finds blocks that have completed all their scheduled sessions, 
 * computes the average scores per coder over the entire block,
 * calls OpenRouter, and saves the Draft Report into block_reports.
 */
export async function generateDraftReportsTask() {
  const supabase = getSupabaseAdmin();

  // Actually, a block is completed if its endDate has passed or its status is COMPLETED.
  // BUT for testing/realistic scenarios, coaches often evaluate the final lesson while the block is still ACTIVE.
  // 2. Fetch recent class_blocks 
  // We use class_blocks because a block itself doesn't belong to a class directly, 
  // it's mapped per class. We scan recent ones.
  const { data: classBlocks, error: blocksError } = await supabase
    .from('class_blocks')
    .select('id, class_id, block_id, start_date, classes!inner(id, name, level_id), blocks!inner(id, name)')
    .order('start_date', { ascending: false })
    .limit(100);

  if (blocksError) {
    console.error(`[AI Cron] Error fetching class_blocks:`, blocksError.message);
  }

  console.log(`[AI Cron] Found ${classBlocks?.length || 0} class_blocks mapping.`);
  
  if (!classBlocks || classBlocks.length === 0) return { success: true, count: 0 };

  const generatedCount = await generateDraftReportsFromClassBlocks(classBlocks as ClassBlockWithRelations[], 'AI Cron');

  return { success: true, count: generatedCount };
}

export async function generateDraftReportsForClasses(classIds: string[]): Promise<{ success: true; count: number }> {
  const normalizedClassIds = Array.from(new Set(classIds.filter(Boolean)));
  if (normalizedClassIds.length === 0) {
    return { success: true, count: 0 };
  }

  const supabase = getSupabaseAdmin();

  const { data: classBlocks, error: blocksError } = await supabase
    .from('class_blocks')
    .select('id, class_id, block_id, start_date, classes!inner(id, name, level_id), blocks!inner(id, name)')
    .in('class_id', normalizedClassIds)
    .order('start_date', { ascending: false });

  if (blocksError) {
    console.error(`[AI Trigger] Error fetching class_blocks:`, blocksError.message);
  }

  if (!classBlocks || classBlocks.length === 0) {
    return { success: true, count: 0 };
  }

  const generatedCount = await generateDraftReportsFromClassBlocks(classBlocks as ClassBlockWithRelations[], 'AI Trigger');

  return { success: true, count: generatedCount };
}
