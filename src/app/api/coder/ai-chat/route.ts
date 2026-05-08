import { NextResponse } from 'next/server';
import { getSessionOrThrow } from '@/lib/auth';
import { getLessonDetailForCoder } from '@/lib/services/coder';
import OpenAI from 'openai';

// Ensure this route handler is fully dynamic
export const dynamic = 'force-dynamic';

const MAX_CHAT_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1200;
const MAX_REQUESTS_PER_WINDOW = 12;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const aiChatRequestLog = new Map<string, number[]>();

function isRateLimited(userId: string): boolean {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const recentRequests = (aiChatRequestLog.get(userId) ?? []).filter((time) => time > windowStart);

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        aiChatRequestLog.set(userId, recentRequests);
        return true;
    }

    recentRequests.push(now);
    aiChatRequestLog.set(userId, recentRequests);
    return false;
}

function sanitizeMessages(messages: unknown) {
    if (!Array.isArray(messages)) {
        return null;
    }

    const safeMessages = messages
        .slice(-MAX_CHAT_MESSAGES)
        .map((message) => {
            if (!message || typeof message !== 'object') {
                return null;
            }

            const role = (message as { role?: unknown }).role;
            const content = (message as { content?: unknown }).content;

            if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') {
                return null;
            }

            return {
                role,
                content: content.slice(0, MAX_MESSAGE_CHARS),
            };
        });

    if (safeMessages.some((message) => message === null)) {
        return null;
    }

    return safeMessages as Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function POST(req: Request) {
    try {
        const session = await getSessionOrThrow();
        if (session.user.role !== 'CODER') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        if (isRateLimited(session.user.id)) {
            return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
        }

        const { messages, lessonContext } = await req.json();
        const classLessonId = lessonContext?.classLessonId;

        const safeMessages = sanitizeMessages(messages);
        if (!safeMessages) {
            return NextResponse.json({ error: 'Invalid messages array' }, { status: 400 });
        }

        if (typeof classLessonId !== 'string' || !classLessonId) {
            return NextResponse.json({ error: 'Invalid lesson context' }, { status: 400 });
        }

        const lesson = await getLessonDetailForCoder(session.user.id, classLessonId);
        if (!lesson) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
- Judul Materi: ${lesson.title || "Tidak diketahui"}
- Ringkasan Materi: ${lesson.summary || "Tidak ada summary."}
- Catatan Tambahan (Instruksi/Hints): ${lesson.make_up_instructions || "Tidak ada catatan."}

ATURAN MENJAWAB:
1. Kamu HARUS 100% fokus menjawab berdasarkan materi di atas.
2. JANGAN menjelaskan panjang lebar hal-hal di luar konteks materi ini. Jika ditanya hal lain, arahkan kembali ke materi.
3. Berikan pancingan untuk Coder berpikir mandiri (seperti tanya balik "Menurut kamu, logikanya gimana kalau..."). Jangan sekadar ngasih jawaban copy-paste tanpa penjelasan.
4. Jaga respon singkat dan mudah dibaca (gunakan paragraf pendek). Gunakan format tebal (**) jika perlu.
5. Jika ada code snippet, usahakan rapi dan singkat.
`
        };

        const apiMessages = [systemMessage, ...safeMessages];

        const response = await openai.chat.completions.create({
            model: 'openai/gpt-4o-mini',
            messages: apiMessages as any,
            stream: true,
            temperature: 0.6, // slightly creative but mostly factual
            max_tokens: 600,
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
