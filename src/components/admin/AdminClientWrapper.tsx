'use client';

import { SessionProvider } from 'next-auth/react';
import { ReminderProvider } from '@/contexts/ReminderContext';
import ReminderModal from '@/components/admin/ReminderModal';
import ReminderFloatingButton from '@/components/admin/ReminderFloatingButton';

export default function AdminClientWrapper({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <ReminderProvider>
                {children}
                <ReminderModal />
                <ReminderFloatingButton />
            </ReminderProvider>
        </SessionProvider>
    );
}
