import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Calculate the platform guarantee fee: 1% or $10, whichever is greater
 */
export function calculateGuaranteeFee(subtotalCents: number): number {
  const onePercent = Math.round(subtotalCents * 0.01);
  const minimumFee = 1000; // $10.00
  return Math.max(onePercent, minimumFee);
}

/**
 * Create a PaymentIntent with manual capture for the shop approval flow
 */
export async function createManualCaptureIntent({
  amountCents,
  shopStripeAccountId,
  guaranteeFeeCents,
  invoiceId,
  payerName,
  customerName,
}: {
  amountCents: number;
  shopStripeAccountId: string;
  guaranteeFeeCents: number;
  invoiceId: string;
  payerName: string;
  customerName: string;
}) {
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    capture_method: "manual",
    application_fee_amount: guaranteeFeeCents,
    transfer_data: {
      destination: shopStripeAccountId,
    },
    metadata: {
      invoice_id: invoiceId,
      payer_name: payerName,
      customer_name: customerName,
    },
  });
}
