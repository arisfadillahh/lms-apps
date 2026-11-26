export const MOTOR_TRIP_RATE = 35_000;
export const MOTOR_TRIP_OPENING_PREFIX = 'transport-motor-opening:';

export const CLASS_MOTOR_TRANSPORT_ACTION = 'CLASS_MOTOR_TRANSPORT';

export type ClassMotorTransportRule = {
  effectiveAt: string;
  coachId: string | null;
};

export function hasAutomaticMotorTransport(
  rules: readonly ClassMotorTransportRule[],
  coachId: string,
  at: string,
): boolean {
  const effective = rules.findLast((rule) => Date.parse(rule.effectiveAt) <= Date.parse(at));
  return effective?.coachId === coachId;
}
