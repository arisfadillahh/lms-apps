import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { Json } from '@/types/supabase';

export type ClassChangeEventType = 'RECURRING_SCHEDULE_UPDATED' | 'LESSON_REASSIGNED' | 'HISTORY_RECONSTRUCTED';

export async function recordClassChangeAudit(input: {
  classId: string;
  actorUserId?: string | null;
  eventType: ClassChangeEventType;
  sessionId?: string | null;
  classLessonId?: string | null;
  beforeState: Json;
  afterState: Json;
  context?: string | null;
}) {
  const { error } = await getSupabaseAdmin().from('class_change_audit_logs').insert({
    class_id: input.classId,
    actor_user_id: input.actorUserId ?? null,
    event_type: input.eventType,
    session_id: input.sessionId ?? null,
    class_lesson_id: input.classLessonId ?? null,
    before_state: input.beforeState,
    after_state: input.afterState,
    context: input.context ?? null,
  });

  if (error) throw new Error(`Failed to record class change audit: ${error.message}`);
}
