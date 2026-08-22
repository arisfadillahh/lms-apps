begin;

alter table public.coder_portfolios
  drop constraint if exists coder_portfolios_complete_content;

alter table public.coder_portfolios
  add constraint coder_portfolios_complete_content check (
    status = 'DRAFT' or (
      char_length(project_type) between 2 and 80
      and char_length(summary) between 10 and 240
      and char_length(description) between 20 and 3000
      and char_length(role_contribution) between 10 and 1500
      and char_length(how_to_play) between 10 and 1500
      and (
        playable_url = ''
        or char_length(playable_url) between 8 and 2000
      )
      and char_length(learning_reflection) between 10 and 2000
      and char_length(next_steps) between 10 and 1500
      and cardinality(tools) > 0
      and cardinality(skills) > 0
    )
  );

commit;
