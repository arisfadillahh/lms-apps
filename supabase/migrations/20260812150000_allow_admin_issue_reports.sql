begin;

alter table public.issue_reports
  drop constraint if exists issue_reports_reporter_role_check;

alter table public.issue_reports
  add constraint issue_reports_reporter_role_check
  check (reporter_role in ('ADMIN', 'COACH', 'CODER'));

comment on table public.issue_reports is
  'Problem reports submitted by authenticated admin, coach, and coder accounts. Access is mediated by LMS server APIs.';

commit;
