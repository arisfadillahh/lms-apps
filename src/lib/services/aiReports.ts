/**
 * Script used to hit OpenRouter (GPT-4o-mini)
 * Auto-generates qualitative report descriptions given raw numeric evaluation scores.
 */
import OpenAI from 'openai';

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import { reportsDao, classesDao } from '@/lib/dao';
import { computeLessonSchedule } from '@/lib/services/lessonScheduler';

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
    const parsed = JSON.parse(content);
    const aiDescriptions = parsed.descriptions || [];

    // Map safely back to the known good criteria IDs to prevent AI hallucinating invalid UUIDs
    return criteriaInput.map((c, index) => {
      const matchedDesc = aiDescriptions.find((d: any) => d.criteriaId === c.criteriaId) || aiDescriptions[index];
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

/**
 * Cron Job Logic to scan and generate draft block reports.
 * Finds blocks that have completed all their scheduled sessions, 
 * computes the average scores per coder over the entire block,
 * calls OpenRouter, and saves the Draft Report into block_reports.
 */
export async function generateDraftReportsTask() {
  const supabase = getSupabaseAdmin();

  // 1. Get all evaluation criteria (to map id -> name)
  const allCriteria = await reportsDao.getEvaluationCriteria();
  const criteriaMap = new Map(allCriteria.map(c => [c.id, c.name]));

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
  
  if (!classBlocks || classBlocks.length === 0) return { success: true, message: 'No blocks found to process.' };

  let generatedCount = 0;

  for (const cb of classBlocks) {
    const klass = Array.isArray(cb.classes) ? cb.classes[0] : cb.classes;
    const block = Array.isArray(cb.blocks) ? cb.blocks[0] : cb.blocks;
    
    if (!klass || !block) continue;

    const classId = klass.id;
    const blockId = block.id;

    // Get all sessions for this block
    const lessonMap = await computeLessonSchedule(classId, klass.level_id);
    const blockSessionIds: string[] = [];
    
    // We only care about sessions mapped to this block
    lessonMap.forEach((slot, sessionId) => {
      if (slot.block.id === blockId) {
        blockSessionIds.push(sessionId);
      }
    });

    if (blockSessionIds.length === 0) {
      console.log(`[AI Cron] Block ${block.name} (ID: ${blockId}) skipped: No sessions mapped to it.`);
      continue;
    }

    // Get all lesson_evaluations for these sessions
    const { data: evaluations } = await supabase
      .from('lesson_evaluations')
      .select('*')
      .in('session_id', blockSessionIds);

    if (!evaluations || evaluations.length === 0) {
      console.log(`[AI Cron] Block ${block.name} (ID: ${blockId}) skipped: No evaluations exist yet.`);
      continue;
    }

    console.log(`[AI Cron] Block ${block.name} has ${evaluations.length} evaluations! Grouping for coders...`);

    // Group evaluations by coderId -> criteriaId -> array of scores
    const coderScores: Record<string, Record<string, number[]>> = {};

    for (const ev of evaluations) {
      if (!coderScores[ev.coder_id]) coderScores[ev.coder_id] = {};
      if (!coderScores[ev.coder_id][ev.criteria_id]) coderScores[ev.coder_id][ev.criteria_id] = [];
      coderScores[ev.coder_id][ev.criteria_id].push(ev.score);
    }

    // Now, for each coder, calculate average scores and generate the block report
    for (const coderId of Object.keys(coderScores)) {
      // Check if a block report already exists for this block & coder
      const existingReport = await reportsDao.getBlockReport(classId, blockId, coderId);
      
      // Prevent double generation. If it exists, skip. 
      // is_ai_generated ensures we only auto-generate once.
      if (existingReport && existingReport.is_ai_generated) {
        console.log(`[AI Cron] Skipping Coder ${coderId} in block ${blockId} because AI report already generated.`);
        continue;
      }
      
      // If it exists but is NOT AI generated, maybe coach manually created it. We shouldn't overwrite unless empty.
      // We will skip if the report is already PUBLISHED manually.
      if (existingReport && existingReport.status === 'PUBLISHED') {
         console.log(`[AI Cron] Skipping Coder ${coderId} in block ${blockId} because the report is already manually PUBLISHED.`);
         continue;
      }

      console.log(`[AI Cron] Proceeding to generate AI Report for Coder ${coderId} in Block ${blockId}...`);

      // Calculate averages and global average
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

      // Fetch Coder name for context
      const { data: coderUser } = await supabase.from('users').select('full_name').eq('id', coderId).single();
      const coderName = coderUser?.full_name || 'Siswa';

      // 2A. Get lesson titles for richer AI context
      const { data: classLessons } = await supabase
        .from('class_lessons')
        .select('lesson:lesson_templates(title)')
        .eq('class_id', classId)
        .eq('block_id', blockId);
      
      let lessonTitlesText = 'Materi Umum';
      if (classLessons && classLessons.length > 0) {
        const titles = classLessons
          .map(cl => Array.isArray(cl.lesson) ? cl.lesson[0]?.title : cl.lesson?.title)
          .filter(t => t);
        if (titles.length > 0) {
          lessonTitlesText = titles.join(', ');
        }
      }

      // 3. Call OpenRouter AI
      const aiDescriptions = await generateBlockReportDescriptions(
        coderName, 
        klass.name, 
        block.name || 'Coding', 
        lessonTitlesText,
        criteriaInput
      );

      // 4. Save to Database
      const newReport = await reportsDao.upsertBlockReport({
        classId,
        blockId,
        coderId,
        status: 'DRAFT',
        averageScore: Number(globalAverage.toFixed(2)),
        grade: finalGrade,
        isAiGenerated: true // Mark as auto-generated so we don't recreate it
      });

      // 5. Save the generated criteria descriptions
      const descPayload = aiDescriptions.map(d => ({
         reportId: newReport.id,
         criteriaId: d.criteriaId,
         score: criteriaInput.find(c => c.criteriaId === d.criteriaId)?.score || 0,
         description: d.description
      }));
      await reportsDao.upsertBlockReportDescriptions(descPayload);

      generatedCount++;
    }
  }

  return { success: true, count: generatedCount };
}
