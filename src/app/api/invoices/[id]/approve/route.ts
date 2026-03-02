import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe, calculateGuaranteeFee } from "@/lib/stripe";
import { sendConfirmation } from "@/lib/twilio";

/**
 * POST /api/invoices/[id]/approve
 * Shop approves the invoice and captures the Stripe payment.
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
    const { notes } = body as { notes?: string };

    // Fetch the invoice and verify ownership
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            guaranteeActive: true,
          },
        },
      },
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
          error: `Cannot approve invoice with status ${invoice.status}. Must be CUSTOMER_AUTHORIZED.`,
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

    // Create the ShopApproval record
    await prisma.shopApproval.create({
      data: {
        invoiceId: id,
        approvedByStaffId: session.user.id,
        decision: "APPROVED",
        notes: notes || null,
      },
    });

    // Capture the Stripe payment
    await stripe.paymentIntents.capture(invoice.stripePaymentIntentId);

    // Update invoice status to SHOP_APPROVED then PAID
    const now = new Date();
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: "PAID",
        shopApprovedAt: now,
        paidAt: now,
      },
    });

    // Create PlatformFee record for the guarantee fee
    if (invoice.shop.guaranteeActive) {
      const guaranteeFeeCents = calculateGuaranteeFee(invoice.subtotalCents);
      await prisma.platformFee.create({
        data: {
          invoiceId: id,
          shopId: invoice.shopId,
          feeType: "GUARANTEE_FEE",
          amountCents: guaranteeFeeCents,
        },
      });
    }

    // Send confirmation SMS to the customer
    await sendConfirmation({
      to: invoice.customerPhone,
      shopName: invoice.shop.name,
      totalCents: invoice.totalCents,
    });

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error("POST /api/invoices/[id]/approve error:", error);
    return NextResponse.json(
      { error: "Failed to approve invoice" },
      { status: 500 }
    );
  }
}
