/**
 * Format cents as a dollar string
 */
export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Calculate the guarantee fee: 1% or $10 minimum
 */
export function calculateGuaranteeFee(subtotalCents: number): number {
  const onePercent = Math.round(subtotalCents * 0.01);
  return Math.max(onePercent, 1000);
}

/**
 * Generate the authorization text for a payment
 */
export function generateAuthorizationText({
  payerName,
  shopName,
  totalCents,
  lastFour,
  customerName,
}: {
  payerName: string;
  shopName: string;
  totalCents: number;
  lastFour: string;
  customerName: string;
}): string {
  return `I, ${payerName}, authorize ${shopName} to charge $${(totalCents / 100).toFixed(2)} to my card ending in ${lastFour} for services rendered to ${customerName}.`;
}

/**
 * Get the disclaimer texts for the consent checkboxes
 */
export function getDisclaimerTexts({
  shopName,
  totalCents,
  lastFour,
  payerName,
  customerName,
  convenienceFeeCents,
}: {
  shopName: string;
  totalCents: number;
  lastFour: string;
  payerName: string;
  customerName: string;
  convenienceFeeCents: number;
}): string[] {
  return [
    `I, ${payerName}, authorize ${shopName} to charge $${(totalCents / 100).toFixed(2)} to my card ending in ${lastFour} for services rendered to ${customerName}.`,
    "I understand that diagnostic fees cover professional inspection time and equipment, regardless of whether I proceed with repairs.",
    "I understand that repairs address the identified issue. Pre-existing conditions or unrelated problems may require separate service. Repair outcomes are not guaranteed.",
    "I acknowledge the line items and amounts listed on this invoice are accurate and I agree to this charge.",
    "I confirm I am the authorized cardholder or have authorization to use this payment method.",
    `A convenience fee of $${(convenienceFeeCents / 100).toFixed(2)} has been added for text-to-pay service.`,
  ];
}
