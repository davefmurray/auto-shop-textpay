import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/stripe
 * Handles incoming Stripe webhook events.
 * Verifies the webhook signature and processes relevant events.
 */
export async function POST(request: NextRequest) {
  let event: Stripe.Event;

  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET is not set");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", message);
    return NextResponse.json(
      { error: `Webhook Error: ${message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        if (invoiceId) {
          const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
          });

          // Only update if not already PAID (avoid double-processing)
          if (invoice && invoice.status !== "PAID") {
            await prisma.invoice.update({
              where: { id: invoiceId },
              data: {
                status: "PAID",
                paidAt: new Date(),
              },
            });
            console.log(
              `Webhook: Invoice ${invoiceId} marked as PAID via payment_intent.succeeded`
            );
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;
        const failureMessage =
          paymentIntent.last_payment_error?.message || "Unknown failure";

        console.error(
          `Webhook: Payment failed for invoice ${invoiceId}: ${failureMessage}`
        );
        break;
      }

      case "charge.dispute.created": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId =
          typeof dispute.charge === "string"
            ? dispute.charge
            : dispute.charge?.id;

        // Look up the charge to find the payment intent
        let invoiceId: string | undefined;
        if (chargeId) {
          const charge = await stripe.charges.retrieve(chargeId);
          const paymentIntentId =
            typeof charge.payment_intent === "string"
              ? charge.payment_intent
              : charge.payment_intent?.id;

          if (paymentIntentId) {
            const invoice = await prisma.invoice.findUnique({
              where: { stripePaymentIntentId: paymentIntentId },
            });
            invoiceId = invoice?.id;
          }
        }

        if (invoiceId) {
          const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
            select: { id: true, shopId: true },
          });

          if (invoice) {
            // Create a GuaranteeClaim record
            await prisma.guaranteeClaim.create({
              data: {
                invoiceId: invoice.id,
                shopId: invoice.shopId,
                stripeDisputeId: dispute.id,
                disputeAmountCents: dispute.amount,
                disputeReasonCode: dispute.reason || null,
                disputeCategory: dispute.reason || null,
                outcome: "PENDING",
              },
            });

            // Update invoice status to DISPUTED
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: "DISPUTED" },
            });

            console.log(
              `Webhook: Dispute created for invoice ${invoice.id}, claim recorded`
            );
          }
        }
        break;
      }

      case "payment_intent.canceled": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        if (invoiceId) {
          const invoice = await prisma.invoice.findUnique({
            where: { id: invoiceId },
          });

          // Mark as EXPIRED if the auth hold expired (not manually rejected)
          if (
            invoice &&
            invoice.status === "CUSTOMER_AUTHORIZED"
          ) {
            await prisma.invoice.update({
              where: { id: invoiceId },
              data: { status: "EXPIRED" },
            });
            console.log(
              `Webhook: Invoice ${invoiceId} marked as EXPIRED (auth hold expired)`
            );
          }
        }
        break;
      }

      default: {
        console.log(`Webhook: Unhandled event type ${event.type}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook handler error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 }
    );
  }
}
