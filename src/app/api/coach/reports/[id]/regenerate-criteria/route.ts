import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import OpenAI from 'openai';

import { getSessionOrThrow } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionUser = await getSessionOrThrow();
    if (!sessionUser || sessionUser.user.role !== 'COACH') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const { id } = resolvedParams;
    const body = await req.json();
    const { criteriaId, criteriaName, score } = body;

    if (!criteriaId || !criteriaName || score === undefined) {
      return NextResponse.json({ error: 'Missing criteria input' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // 1. Fetch Report Details
    const { data: report } = await supabase
      .from('block_reports')
      .select(`
        id,
        status,
        coder:users!block_reports_coder_id_fkey(full_name),
        class:classes(id, name),
        block:blocks(id, name)
      `)
      .eq('id', id)
      .single();

    if (!report) {
       return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const coderName = Array.isArray(report.coder) ? report.coder[0]?.full_name : report.coder?.full_name;
    const klass = Array.isArray(report.class) ? report.class[0] : report.class;
    const className = klass?.name;
    const classId = klass?.id || '';
    const blockId = Array.isArray(report.block) ? report.block[0]?.id : report.block?.id;
    const blockName = Array.isArray(report.block) ? report.block[0]?.name : report.block?.name;

    // 2. Fetch completed lessons for richer AI context
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

    // 3. Prompt AI using OpenRouter
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenRouter API Key is missing' }, { status: 500 });
    }

    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://lms.clevio.co',
        'X-Title': 'Clevio LMS',
      }
    });

    const prompt = `
Kamu adalah Coach/Tutor coding di Clevio Coder Camp. Tugasmu direvisi: buat 1 paragraf (2-4 kalimat lengkap) detail dan personal untuk siswa bernama ${coderName}.
Kelas: ${className}
Topik Block: ${blockName}
Materi yang sudah dipelajari: ${lessonTitlesText}

Kriteria Penilaian: ${criteriaName}
Nilai yang didapat: ${Number(score).toFixed(1)}/10

Instruksi:
- Kamu HANYA merespon dengan teks paragraf deskripsinya langsung. Jangan tambahkan basa-basi, jangan gunakan json.
- Berikan pujian spesifik dan atau saran perbaikan yang membangun terkait kriteria tersebut, menggunakan bahasa Indonesia baku tapi ramah (seperti rapor naratif).
- Hubungkan dengan konteks 'Materi yang sudah dipelajari' sedapat mungkin agar terkesan lebih detail dan nyambung (Misal: "Saat mempelajari [Materi], Ananda ${coderName} sangat cepat menangkap...").
- Jangan menyebutkan angka skor secara eksplisit.
`;

    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 300
    });

    const generatedText = response.choices[0]?.message?.content?.trim() || 'Gagal membuat deskripsi.';

    return NextResponse.json({ success: true, description: generatedText });
  } catch (error: any) {
    console.error('Error generating criteria description:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
