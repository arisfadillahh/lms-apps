export const MOTOR_TRIP_RATE = 35_000;
export const MOTOR_TRIP_OPENING_PREFIX = 'transport-motor-opening:';

export const CLASS_MOTOR_TRANSPORT_ACTION = 'CLASS_MOTOR_TRANSPORT';
export const CLASS_TRANSPORT_TYPES = ['MOTOR', 'PUBLIC_TRANSPORT', 'NONE'] as const;
export type ClassTransportType = (typeof CLASS_TRANSPORT_TYPES)[number];

export type ClassMotorTransportRule = {
  effectiveAt: string;
  coachId: string | null;
  assignedCoachId?: string;
  transportType?: ClassTransportType;
};

export function resolveClassTransportType(
  rules: readonly ClassMotorTransportRule[],
  coachId: string,
  at: string,
): ClassTransportType | null {
  const effective = rules.findLast((rule) => Date.parse(rule.effectiveAt) <= Date.parse(at));
  if (!effective || (effective.assignedCoachId ?? effective.coachId) !== coachId) return null;
  return effective.transportType ?? (effective.coachId === coachId ? 'MOTOR' : null);
}

export function hasAutomaticMotorTransport(
  rules: readonly ClassMotorTransportRule[],
  coachId: string,
  at: string,
): boolean {
  return resolveClassTransportType(rules, coachId, at) === 'MOTOR';
}
