'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, User, ChevronDown, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface AIChatbotProps {
    lessonTitle: string;
    lessonSummary: string;
    lessonMakeUpInstructions?: string | null;
}

export default function AIChatbot({ lessonTitle, lessonSummary, lessonMakeUpInstructions }: AIChatbotProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'assistant', content: `Halo! 👋 Aku Clevio Coach AI. Ada pertanyaan tentang materi *${lessonTitle}* ini?` }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom of chat
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isLoading) return;

        const userMessage = input.trim();
        setInput('');
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        // Placeholder for AI thinking message
        setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

        try {
            const res = await fetch('/api/coder/ai-chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: [...messages, { role: 'user', content: userMessage }].map(m => ({ role: m.role, content: m.content })),
                    lessonContext: {
                        title: lessonTitle,
                        summary: lessonSummary,
                        instructions: lessonMakeUpInstructions
                    }
                })
            });

            if (!res.ok) throw new Error('Failed to get AI response');
            if (!res.body) throw new Error('No body returned from API');

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let aiMessage = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                aiMessage += chunk;

                // Update the last message (the placeholder) with the actual streamed content
                setMessages(prev => {
                    const newMessages = [...prev];
                    newMessages[newMessages.length - 1] = { role: 'assistant', content: aiMessage };
                    return newMessages;
                });
            }

        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev => {
                const newMessages = [...prev];
                newMessages[newMessages.length - 1] = { role: 'assistant', content: 'Maaf, terjadi kesalahan saat menyambung ke otak AI. Coba lagi sebentar ya! 😅' };
                return newMessages;
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Markdown removed in favor of ReactMarkdown

    return (
        <>
            {/* --- Floating Button --- */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-6 right-10 z-50 flex items-center justify-center w-14 h-14 bg-[#2563eb] text-white rounded-full shadow-[0_10px_25px_-5px_rgba(37,99,235,0.4)] hover:shadow-[0_10px_25px_-5px_rgba(90,152,50,0.5)] hover:-translate-y-1 hover:bg-clevio-green active:scale-95 transition-all text-sm font-bold group"
                    >
                        <Bot className="w-7 h-7 group-hover:animate-bounce" />
                        
                        {/* Ping indicator */}
                        <span className="absolute top-0 right-0 flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-clevio-green border-2 border-white"></span>
                        </span>
                    </motion.button>
                )}
            </AnimatePresence>

            {/* --- Chat Window --- */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="fixed bottom-6 right-10 z-50 w-full max-w-[380px] h-[550px] max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-slate-200/60 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-clevio-navy via-[#2A5082] to-[#1A2F4F] p-4 flex items-center justify-between shrink-0 shadow-sm relative overflow-hidden">
                            {/* Decorative particles */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
                            
                            <div className="flex items-center gap-3 relative z-10">
                                <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20 shadow-inner">
                                    <Bot className="text-white w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-white font-bold text-sm">Clevio Coach AI</h3>
                                    <p className="text-sky-100 text-[11px] flex items-center gap-1 font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-sky animate-pulse"></span>
                                        Online
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-2 rounded-lg transition-colors relative z-10"
                            >
                                <ChevronDown className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50" style={{ scrollbarWidth: 'thin' }}>
                            {/* Scoped CSS: collapse p margin inside list items to fix loose-list spacing */}
                            <style>{`.ai-prose li > p { margin: 0; line-height: 1.5; } .ai-prose li { margin-bottom: 0.15rem; } .ai-prose ol, .ai-prose ul { margin-bottom: 0.5rem; } .ai-prose h3, .ai-prose h4 { font-weight: 700; margin-bottom: 0.25rem; }`}</style>
                            {/* Context Banner */}
                            <div className="bg-pastel-blue/30 border border-sky/30 rounded-xl p-3 text-xs text-clevio-navy text-center flex flex-col items-center gap-1.5">
                                <MessageSquare className="w-4 h-4 text-sky" />
                                <span className="font-medium">AI Fokus pada materi ini:</span>
                                <strong className="text-clevio-navy leading-tight">"{lessonTitle}"</strong>
                            </div>

                            {messages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} max-w-full`}>
                                    <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                        
                                        {/* Avatar */}
                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm border ${msg.role === 'user' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-sky text-white border-sky/80 shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)]'}`}>
                                            {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                        </div>

                                        {/* Bubble */}
                                        <div className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed shadow-sm ${
                                            msg.role === 'user' 
                                            ? 'bg-slate-800 text-white rounded-tr-sm' 
                                            : 'bg-white text-slate-700 border border-slate-200 rounded-tl-sm'
                                        }`}>
                                            {msg.content === '' && isLoading && i === messages.length - 1 ? (
                                                <div className="flex gap-1 py-1.5 px-1">
                                                    <div className="w-1.5 h-1.5 bg-sky rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                                    <div className="w-1.5 h-1.5 bg-sky rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                                    <div className="w-1.5 h-1.5 bg-sky rounded-full animate-bounce"></div>
                                                </div>
                                            ) : (
                                                <div className={`ai-prose space-y-1 break-words flex flex-col ${msg.role === 'user' ? 'text-white' : 'text-slate-700'}`}>
                                                    <ReactMarkdown 
                                                        remarkPlugins={[remarkGfm]}
                                                        components={{
                                                            strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                                                            a: ({node, ...props}) => <a className={`${msg.role === 'user' ? 'text-sky-300' : 'text-sky-600'} hover:underline font-semibold`} target="_blank" {...props} />,
                                                            code: ({node, inline, className, children, ...props}: any) => {
                                                                return inline 
                                                                    ? <code className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-bold ${msg.role === 'user' ? 'bg-slate-700 text-slate-100' : 'bg-slate-100 text-pink-600'}`} {...props}>{children}</code>
                                                                    : <div className="my-2 w-full overflow-hidden rounded-xl border border-slate-700/50 bg-[#0d1117]"><div className="flex px-3 py-1.5 bg-slate-800 border-b border-slate-700"><span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">CODE</span></div><pre className="p-3 overflow-x-auto font-mono text-[11px] text-slate-200" {...props}>{children}</pre></div>
                                                            },
                                                            p: ({node, ...props}) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                                            ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-1 space-y-0" {...props} />,
                                                            ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-1 space-y-0" {...props} />,
                                                            li: ({node, ...props}) => <li className="leading-snug" {...props} />,
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
                            <form onSubmit={handleSubmit} className="relative flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 shadow-sm focus-within:ring-2 focus-within:ring-sky/30 focus-within:border-sky transition-all">
                                <textarea
                                    className="w-full bg-transparent max-h-32 min-h-[44px] px-3 py-2.5 text-sm resize-none focus:outline-none text-slate-700 placeholder:text-slate-400"
                                    placeholder="Tanya materi ini..."
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                        e.target.style.height = '44px';
                                        e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                />
                                <button 
                                    type="submit"
                                    disabled={!input.trim() || isLoading}
                                    className="shrink-0 mb-1 mr-1 p-2 rounded-xl bg-sky text-white disabled:opacity-50 disabled:bg-slate-300 transition-colors shadow-sm self-end"
                                >
                                    <Send className="w-4 h-4 ml-0.5" />
                                </button>
                            </form>
                            <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">
                                AI bisa berbuat salah. Tekan Shift + Enter untuk garis baru.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
