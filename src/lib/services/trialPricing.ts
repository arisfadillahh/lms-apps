export const DEFAULT_TRIAL_REGISTRATION_FEE = 300_000;

type TrialProgramPriceInput = {
  baseMonthly: number;
  durationMonths: number;
  planDiscountPercent: number;
  discountAmount: number;
  registrationFee?: number;
};

export function calculateTrialProgramPrice(input: TrialProgramPriceInput) {
  const packageSubtotal = Math.max(0, Math.round(input.baseMonthly * input.durationMonths));
  const planDiscount = Math.max(0, Math.round((packageSubtotal * input.planDiscountPercent) / 100));
  const basePrice = Math.max(0, packageSubtotal - planDiscount);
  const registrationFee = Math.max(0, Math.round(input.registrationFee ?? DEFAULT_TRIAL_REGISTRATION_FEE));
  const discountAmount = Math.max(0, Math.round(input.discountAmount));
  const grossPrice = basePrice + registrationFee;
  const finalPrice = Math.max(0, grossPrice - discountAmount);

  return { packageSubtotal, planDiscount, basePrice, registrationFee, grossPrice, discountAmount, finalPrice };
}
