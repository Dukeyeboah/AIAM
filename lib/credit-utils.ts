/**
 * Dynamic Credit Pricing System
 * All features are available to everyone, with add-on costs
 */

export const BASE_AFFIRMATION_COST = 20; // Affirmation + generic image
export const PERSONAL_IMAGE_COST = 50; // Additional cost when using personal reference images (nano-banana-pro model)
export const VOICE_CLONE_COST = 20; // Additional cost for voice clone playback

export interface CreditCalculation {
  base: number;
  personalImage: number;
  voiceClone: number;
  total: number;
}

/**
 * Calculate the total credit cost for an affirmation generation
 * Base cost (20) includes affirmation + generic image
 * Personal image adds +10 (total 30)
 * Voice clone adds +20
 */
export function calculateCreditCost(options: {
  usePersonalImage?: boolean;
  useVoiceClone?: boolean;
}): CreditCalculation {
  const base = BASE_AFFIRMATION_COST;
  const personalImage = options.usePersonalImage ? PERSONAL_IMAGE_COST : 0;
  const voiceClone = options.useVoiceClone ? VOICE_CLONE_COST : 0;

  const total = base + personalImage + voiceClone;

  return {
    base,
    personalImage,
    voiceClone,
    total,
  };
}

/**
 * Check if user has enough credits for a generation
 */
export function hasEnoughCredits(
  currentCredits: number,
  options: {
    usePersonalImage?: boolean;
    useVoiceClone?: boolean;
  }
): boolean {
  const cost = calculateCreditCost(options);
  return currentCredits >= cost.total;
}

/**
 * Get remaining affirmations possible with current credits
 */
export function getRemainingAffirmations(
  currentCredits: number,
  minCost: number = BASE_AFFIRMATION_COST
): number {
  return Math.floor(currentCredits / minCost);
}

/**
 * Check if credits are low (less than 2 basic affirmations)
 */
export function isLowOnCredits(currentCredits: number): boolean {
  return currentCredits < BASE_AFFIRMATION_COST * 2;
}
