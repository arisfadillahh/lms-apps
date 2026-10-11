update public.blocks as block
set is_published = true,
    updated_at = now()
where block.is_published = false
  and exists (
    select 1
    from public.lesson_templates as lesson
    where lesson.block_id = block.id
      and lesson.is_archived = false
  );
