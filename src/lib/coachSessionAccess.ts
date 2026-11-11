/** A substitute replaces the primary coach for this meeting; approved leave never grants the absent coach access. */
export function assignedSessionCoachId(
  primaryCoachId: string,
  substituteCoachId: string | null | undefined,
  approvedLeave?: { substitute_coach_id: string | null } | null,
): string | null {
  return substituteCoachId || approvedLeave?.substitute_coach_id || (approvedLeave ? null : primaryCoachId);
}
