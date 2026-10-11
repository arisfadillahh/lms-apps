import type { ClassRecord } from '@/lib/dao/classesDao';

type TransferClass = Pick<ClassRecord, 'id' | 'type' | 'level_id' | 'lifecycle_status' | 'end_date' | 'archived_at'>;

export function isValidTransferTarget(source: TransferClass, target: TransferClass, today = new Date().toISOString().slice(0, 10)): boolean {
  return source.id !== target.id
    && source.type === target.type
    && source.lifecycle_status === 'ACTIVE'
    && target.lifecycle_status === 'ACTIVE'
    && target.archived_at === null
    && target.end_date >= today
    && (source.type !== 'WEEKLY' || (source.level_id !== null && source.level_id === target.level_id));
}
