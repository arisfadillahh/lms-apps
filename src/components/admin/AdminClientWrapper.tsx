'use client';

import { ReminderProvider } from '@/contexts/ReminderContext';
import ReminderModal from '@/components/admin/ReminderModal';
import ReminderFloatingButton from '@/components/admin/ReminderFloatingButton';

export default function AdminClientWrapper({ children }: { children: React.ReactNode }) {
    return (
        <ReminderProvider>
            {children}
            <ReminderModal />
            <ReminderFloatingButton />
        </ReminderProvider>
    );
}
