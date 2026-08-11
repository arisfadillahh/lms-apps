import OpenAI from 'openai';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getSessionOrThrow } from '@/lib/auth';
import { assertRole } from '@/lib/roles';
import { applyTypoReplacements, type TypoReplacement } from '@/lib/services/trialInsightTypos';

const requestSchema = z.object({
  text: z.string().max(4000),
});

const responseSchema = z.object({
  replacements: z.array(z.object({
    from: z.string(),
    to: z.string(),
  })).max(12),
});

export async function POST(request: Request) {
  try {
    const session = await getSessionOrThrow();
    await assertRole(session, 'ADMIN');

    const parsedRequest = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'Teks Coach insight tidak valid.' }, { status: 400 });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Layanan koreksi typo belum dikonfigurasi.' }, { status: 503 });
    }

    const openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey,
      defaultHeaders: {
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://lms.clevio.co',
        'X-Title': 'Clevio LMS',
      },
    });

    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Kamu adalah proofreader typo yang sangat ketat.

Tugasmu hanya menemukan salah ketik pada teks Coach insight di bawah ini.
Jangan mengubah kalimat, tata bahasa, pilihan kata, gaya bahasa, kapitalisasi yang bukan typo, tanda baca, spasi, urutan kata, atau makna.
Jangan menerjemahkan dan jangan menulis ulang.
Jika tidak ada typo, kembalikan replacements kosong.

Kembalikan HANYA JSON valid dengan bentuk:
{"replacements":[{"from":"teks asli yang salah","to":"teks perbaikan typo"}]}

Setiap nilai from harus merupakan potongan teks yang muncul persis di teks asli. Buat potongan sesingkat mungkin dan hanya mencakup typo yang diperbaiki.

TEKS ASLI:
<<<${parsedRequest.data.text}>>>`,
      }],
      temperature: 0,
      max_tokens: 800,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content?.trim() || '{}';
    const parsedResponse = responseSchema.safeParse(JSON.parse(content));
    if (!parsedResponse.success) {
      return NextResponse.json({ error: 'Hasil koreksi typo dari AI tidak valid.' }, { status: 502 });
    }

    const result = applyTypoReplacements(parsedRequest.data.text, parsedResponse.data.replacements as TypoReplacement[]);
    if (result.rejected.length && !result.applied.length) {
      return NextResponse.json({ error: 'Hasil AI tidak dapat divalidasi sebagai koreksi typo yang aman.' }, { status: 422 });
    }

    return NextResponse.json({
      text: result.text,
      changes: result.applied.length,
      skipped: result.rejected.length,
    });
  } catch (error) {
    console.error('[TrialAssessment] Fix coach insight typos failed', error);
    return NextResponse.json({ error: 'Gagal memproses koreksi typo.' }, { status: 500 });
  }
}
