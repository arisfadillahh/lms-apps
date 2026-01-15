"use server";

import { getSupabaseAdmin } from '@/lib/supabaseServer';
import type { TablesRow } from '@/types/supabase';

export type EkskulLessonPlanRecord = TablesRow<'ekskul_lesson_plans'>;
export type EkskulLessonRecord = TablesRow<'ekskul_lessons'>;
export type SoftwareRecord = TablesRow<'software'>;

export type EkskulPlanWithDetails = EkskulLessonPlanRecord & {
    ekskul_lessons: EkskulLessonRecord[];
    ekskul_plan_software: {
        software: SoftwareRecord;
    }[];
};

export async function getEkskulPlanWithDetails(id: string): Promise<EkskulPlanWithDetails | null> {
    const supabase = getSupabaseAdmin();

    // Use 'as any' to bypass TypeScript's strict type checking for nested joins
    // Supabase types may not be fully generated for all relations
    const { data, error } = await (supabase
        .from('ekskul_lesson_plans') as any)
        .select(`
      *,
      ekskul_lessons(*),
      ekskul_plan_software(
        software(*)
      )
    `)
        .eq('id', id)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw new Error(`Failed to fetch ekskul plan details: ${error.message}`);
    }

    // Sort lessons by order_index
    if (data && data.ekskul_lessons && Array.isArray(data.ekskul_lessons)) {
        data.ekskul_lessons.sort((a: EkskulLessonRecord, b: EkskulLessonRecord) =>
            (a.order_index || 0) - (b.order_index || 0)
        );
    }

    return data as EkskulPlanWithDetails | null;
}

export async function getEkskulLessonById(lessonId: string): Promise<EkskulLessonRecord | null> {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
        .from('ekskul_lessons')
        .select('*')
        .eq('id', lessonId)
        .single();

    if (error) {
        if (error.code === 'PGRST116') return null;
        return null; // Silent fail
    }

    return data as EkskulLessonRecord;
}
