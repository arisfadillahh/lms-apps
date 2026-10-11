import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('deferred block placement contract', () => {
  it('uses the existing in-app notification table once for each new placement', () => {
    const sql = readFileSync('supabase/migrations/20261011120000_deferred_block_placement.sql', 'utf8');
    expect(sql).toContain('INSERT INTO public.notifications(user_id, title, message, type, is_read, reference_key)');
    expect(sql).toContain('notifications_recipient_reference_idx');
    expect(sql).toContain('IF v_placement_id IS NOT NULL THEN');
    expect(sql).not.toContain('whatsapp');
  });

  it('shows current same-level class choices and routes action through official transfer', () => {
    const page = readFileSync('src/app/(admin)/admin/block-placements/page.tsx', 'utf8');
    const button = readFileSync('src/app/(admin)/admin/classes/[id]/TransferCoderButton.tsx', 'utf8');
    const sql = readFileSync('supabase/migrations/20261011120000_deferred_block_placement.sql', 'utf8');
    expect(page).toContain(".eq('status', 'NEEDS_BLOCK_PLACEMENT')");
    expect(page).toContain(".eq('status', 'CURRENT')");
    expect(page).toContain("klass.level_id === row.level_id");
    expect(page).toContain('<TransferCoderButton');
    expect(button).toContain('/transfer`');
    expect(sql).toContain('PERFORM public.align_transferred_coder_journey(');
    expect(sql).not.toContain('PERFORM public.finalize_coder_level(');
  });

  it('keeps deferred metadata during manual progress updates', () => {
    const route = readFileSync('src/app/api/admin/classes/[id]/progress/bypass/route.ts', 'utf8');
    expect(route).toContain(".select('id, block_id, journey_order, deferred_after_class, entry_lesson_position')");
    expect(route).toContain('!item.deferred_after_class');
    expect(route).toContain('deferred_after_class: item.deferred_after_class');
    expect(route).toContain('entry_lesson_position: item.entry_lesson_position');
  });
});
