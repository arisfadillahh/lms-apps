import { effective, money, type PayrollPerson, type PayrollTerm } from './model';

export interface PayrollCoachAccount { id: string; full_name: string; username: string; is_active: boolean }
export interface PayrollPeopleRow {
  id: string; name: string; kind: 'COACH' | 'STAFF'; jobTitle: string; active: boolean;
  profile?: PayrollPerson; coachId?: string; term?: PayrollTerm; startsLater?: string; monthly: number | null;
  needsSetup: boolean; salaryPending?: boolean;
}
export function payrollPeopleRows(people: PayrollPerson[], terms: PayrollTerm[], coaches: PayrollCoachAccount[], date: string): PayrollPeopleRow[] {
  const rows: PayrollPeopleRow[] = people.map(profile => {
    const history = terms.filter(t => t.profile_id === profile.id);
    const term = effective(history, date);
    const future = history.filter(t => t.effective_from > date).sort((a,b) => a.effective_from.localeCompare(b.effective_from))[0];
    const salaryPending = term?.contract === 'FULLTIME' && term.base_salary <= 0;
    return { id: profile.id, name: profile.name, kind: profile.kind, jobTitle: profile.job_title, active: profile.active,
      profile, coachId: profile.user_id ?? undefined, term, startsLater: term ? undefined : future?.effective_from,
      monthly: term && !salaryPending ? money((term.contract === 'FULLTIME' ? term.base_salary : 0) + (term.position_allowance ?? 0) + (term.other_allowances ?? []).reduce((n,a) => n+a.amount,0)) : null,
      needsSetup: (!term && !future) || salaryPending, salaryPending,
    };
  });
  for (const coach of coaches) if (!people.some(p => p.user_id === coach.id)) rows.push({
    id: `coach:${coach.id}`, name: coach.full_name, kind: 'COACH', jobTitle: 'Coach', active: coach.is_active,
    coachId: coach.id, monthly: null, needsSetup: true,
  });
  return rows.sort((a,b) => a.name.localeCompare(b.name,'id'));
}
