import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import OpenAI from 'openai';

// Ensure this route handler is fully dynamic
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    try {
        const session = await getSessionOrThrow();
        // Allow Coders only (or alternatively, loosen this if a coach tests it via /coder/...)
        if (session.user.role !== 'CODER' && session.user.role !== 'COACH' && session.user.role !== 'ADMIN') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const { messages, lessonContext } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
        }

        const apiKey = process.env.OPENROUTER_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenRouter API Key is missing' }, { status: 500 });
        }

        const openai = new OpenAI({
            baseURL: "https://openrouter.ai/api/v1",
            apiKey: apiKey,
            defaultHeaders: {
                "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000", // Required by OpenRouter
                "X-Title": "Clevio LMS AI Assistant", // Required by OpenRouter
            }
        });

        // Construct System Prompt
        const systemMessage = {
            role: 'system',
            content: `Kamu adalah asisten AI (pengajar yang ramah, asik, bersemangat, pakai sapaan 'Kakak' atau santai tapi sopan layaknya seorang mentor IT Clevio) yang mendampingi siswa ("Coder") belajar pemrograman.

FOKUS MATERI SAAT INI:
- Judul Materi: ${lessonContext.title || "Tidak diketahui"}
- Ringkasan Materi: ${lessonContext.summary || "Tidak ada summary."}
- Catatan Tambahan (Instruksi/Hints): ${lessonContext.instructions || "Tidak ada catatan."}

ATURAN MENJAWAB:
1. Kamu HARUS 100% fokus menjawab berdasarkan materi di atas.
2. JANGAN menjelaskan panjang lebar hal-hal di luar konteks materi ini. Jika ditanya hal lain, arahkan kembali ke materi.
3. Berikan pancingan untuk Coder berpikir mandiri (seperti tanya balik "Menurut kamu, logikanya gimana kalau..."). Jangan sekadar ngasih jawaban copy-paste tanpa penjelasan.
4. Jaga respon singkat dan mudah dibaca (gunakan paragraf pendek). Gunakan format tebal (**) jika perlu.
5. Jika ada code snippet, usahakan rapi dan singkat.
`
        };

        const apiMessages = [systemMessage, ...messages];

        // Ensure messages are properly formatted for OpenAI schema
        const safeMessages = apiMessages.map(m => ({
            role: m.role,
            content: m.content
        }));

        const response = await openai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: safeMessages as any,
            stream: true,
            temperature: 0.6, // slightly creative but mostly factual
            max_tokens: 1000,
        });

        // Create a ReadableStream from the OpenAI AsyncIterable
        const stream = new ReadableStream({
            async start(controller) {
                const encoder = new TextEncoder();
                try {
                    for await (const chunk of response) {
                        const content = chunk.choices[0]?.delta?.content || "";
                        if (content) {
                            controller.enqueue(encoder.encode(content));
                        }
                    }
                } catch (err) {
                    console.error('Streaming error:', err);
                    controller.error(err);
                } finally {
                    controller.close();
                }
            }
        });

        // Return the stream
        return new Response(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache, no-transform',
            }
        });

    } catch (error: any) {
        console.error('AI Chat Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}
