import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/invoices/[id]/reject
 * Shop rejects the invoice and cancels the Stripe payment hold.
 * Requires authentication.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { rejectionReason, notes } = body as {
      rejectionReason: string;
      notes?: string;
    };

    if (!rejectionReason) {
      return NextResponse.json(
        { error: "rejectionReason is required" },
        { status: 400 }
      );
    }

    // Fetch the invoice and verify ownership
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    if (invoice.shopId !== session.user.shopId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (invoice.status !== "CUSTOMER_AUTHORIZED") {
      return NextResponse.json(
        {
          error: `Cannot reject invoice with status ${invoice.status}. Must be CUSTOMER_AUTHORIZED.`,
        },
        { status: 400 }
      );
    }

    if (!invoice.stripePaymentIntentId) {
      return NextResponse.json(
        { error: "No payment intent found for this invoice" },
        { status: 400 }
      );
    }

    // Create the ShopApproval record with REJECTED decision
    await prisma.shopApproval.create({
      data: {
        invoiceId: id,
        approvedByStaffId: session.user.id,
        decision: "REJECTED",
        rejectionReason,
        notes: notes || null,
      },
    });

    // Cancel the Stripe PaymentIntent to release the hold
    await stripe.paymentIntents.cancel(invoice.stripePaymentIntentId);

    // Update invoice status to REJECTED
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: "REJECTED",
      },
    });

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error("POST /api/invoices/[id]/reject error:", error);
    return NextResponse.json(
      { error: "Failed to reject invoice" },
      { status: 500 }
    );
  }
}
