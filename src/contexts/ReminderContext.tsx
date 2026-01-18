'use client';

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Types
export interface ReminderItem {
    id: string;
    invoice_number: string;
    parent_name: string;
    status: 'pending' | 'sending' | 'success' | 'error' | 'stopped';
    error?: string;
}

interface ReminderContextType {
    queue: ReminderItem[];
    isProcessing: boolean;
    isStopped: boolean;
    isMinimized: boolean;
    isVisible: boolean;
    whatsappDelay: { min: number; max: number };

    // Actions
    startReminder: (items: Omit<ReminderItem, 'status'>[], delay?: { min: number; max: number }) => void;
    stopReminder: () => void;
    retryFailed: () => void;
    setMinimized: (minimized: boolean) => void;
    closeReminder: () => void;

    // Stats
    getProgress: () => { sent: number; failed: number; total: number; percentage: number };
}

const ReminderContext = createContext<ReminderContextType | null>(null);

export function useReminder() {
    const context = useContext(ReminderContext);
    if (!context) {
        throw new Error('useReminder must be used within ReminderProvider');
    }
    return context;
}

export function ReminderProvider({ children }: { children: React.ReactNode }) {
    const [queue, setQueue] = useState<ReminderItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isStopped, setIsStopped] = useState(false);
    const [isMinimized, setIsMinimized] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [whatsappDelay, setWhatsappDelay] = useState({ min: 10, max: 30 });

    const stopRef = useRef(false);

    const getProgress = useCallback(() => {
        const sent = queue.filter(i => i.status === 'success').length;
        const failed = queue.filter(i => i.status === 'error').length;
        const total = queue.length;
        const percentage = total > 0 ? Math.round(((sent + failed) / total) * 100) : 0;
        return { sent, failed, total, percentage };
    }, [queue]);

    const processQueue = useCallback(async (items: ReminderItem[], delay: { min: number; max: number }) => {
        setIsProcessing(true);
        stopRef.current = false;

        for (let i = 0; i < items.length; i++) {
            // Check if stopped at start of each iteration
            if (stopRef.current) {
                // Mark remaining as stopped
                setQueue(prev => prev.map((item, idx) =>
                    idx >= i && item.status === 'pending'
                        ? { ...item, status: 'stopped' }
                        : item
                ));
                break;
            }

            const item = items[i];
            if (item.status !== 'pending') continue;

            // Update to sending
            setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'sending' } : q));

            // Check again before API call
            if (stopRef.current) {
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'stopped' } : q));
                break;
            }

            try {
                const res = await fetch('/api/whatsapp/send-single-reminder', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ invoiceId: item.id })
                });
                const data = await res.json();

                if (stopRef.current) {
                    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'stopped' } : q));
                    break;
                }

                if (data.success) {
                    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'success' } : q));
                } else {
                    setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: data.error || 'Unknown error' } : q));
                }
            } catch (error) {
                setQueue(prev => prev.map(q => q.id === item.id ? { ...q, status: 'error', error: String(error) } : q));
            }

            // Interruptible delay - check every 500ms
            if (i < items.length - 1 && !stopRef.current) {
                const delayMs = Math.floor(Math.random() * (delay.max - delay.min + 1) + delay.min) * 1000;
                const checkInterval = 500;
                let waited = 0;

                while (waited < delayMs && !stopRef.current) {
                    await new Promise(resolve => setTimeout(resolve, Math.min(checkInterval, delayMs - waited)));
                    waited += checkInterval;
                }

                // If stopped during delay, mark remaining as stopped
                if (stopRef.current) {
                    setQueue(prev => prev.map((item, idx) =>
                        idx > i && item.status === 'pending'
                            ? { ...item, status: 'stopped' }
                            : item
                    ));
                    break;
                }
            }
        }

        setIsProcessing(false);
        setIsStopped(false);
    }, []);

    const startReminder = useCallback((items: Omit<ReminderItem, 'status'>[], delay?: { min: number; max: number }) => {
        const newQueue: ReminderItem[] = items.map(item => ({ ...item, status: 'pending' }));
        setQueue(newQueue);
        setIsVisible(true);
        setIsMinimized(false);
        setIsStopped(false);

        if (delay) {
            setWhatsappDelay(delay);
        }

        // Auto-start processing
        processQueue(newQueue, delay || whatsappDelay);
    }, [processQueue, whatsappDelay]);

    const stopReminder = useCallback(() => {
        stopRef.current = true;
        setIsStopped(true);
    }, []);

    const retryFailed = useCallback(() => {
        // Reset failed and stopped items to pending
        setQueue(prev => prev.map(item =>
            item.status === 'error' || item.status === 'stopped'
                ? { ...item, status: 'pending', error: undefined }
                : item
        ));

        // Get items to retry
        const itemsToRetry = queue.filter(i => i.status === 'error' || i.status === 'stopped');
        if (itemsToRetry.length > 0) {
            const updatedQueue = queue.map(item =>
                item.status === 'error' || item.status === 'stopped'
                    ? { ...item, status: 'pending' as const, error: undefined }
                    : item
            );
            setQueue(updatedQueue);
            processQueue(updatedQueue, whatsappDelay);
        }
    }, [queue, processQueue, whatsappDelay]);

    const closeReminder = useCallback(() => {
        if (!isProcessing) {
            setIsVisible(false);
            setQueue([]);
        }
    }, [isProcessing]);

    return (
        <ReminderContext.Provider value={{
            queue,
            isProcessing,
            isStopped,
            isMinimized,
            isVisible,
            whatsappDelay,
            startReminder,
            stopReminder,
            retryFailed,
            setMinimized: setIsMinimized,
            closeReminder,
            getProgress
        }}>
            {children}
        </ReminderContext.Provider>
    );
}
