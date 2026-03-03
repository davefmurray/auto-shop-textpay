import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/admin/disputes/[id]/reimburse
 * Reimburses a shop for a lost dispute by creating a Stripe transfer
 * to their connected account and updating the claim status.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "OWNER") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const body = await request.json();
    const { amount_cents } = body as { amount_cents: number };

    if (!amount_cents || amount_cents <= 0) {
      return NextResponse.json(
        { error: "amount_cents is required and must be positive" },
        { status: 400 }
      );
    }

    // Fetch the guarantee claim with shop data
    const claim = await prisma.guaranteeClaim.findUnique({
      where: { id },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            stripeConnectAccountId: true,
          },
        },
        invoice: {
          select: {
            id: true,
            totalCents: true,
          },
        },
      },
    });

    if (!claim) {
      return NextResponse.json(
        { error: "Guarantee claim not found" },
        { status: 404 }
      );
    }

    if (claim.outcome === "REIMBURSED") {
      return NextResponse.json(
        { error: "This claim has already been reimbursed" },
        { status: 400 }
      );
    }

    if (!claim.shop.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "Shop does not have a Stripe connected account" },
        { status: 400 }
      );
    }

    // Create a transfer to the shop's connected account
    const transfer = await stripe.transfers.create({
      amount: amount_cents,
      currency: "usd",
      destination: claim.shop.stripeConnectAccountId,
      description: `Guarantee reimbursement for dispute on invoice ${claim.invoice.id}`,
      metadata: {
        guarantee_claim_id: claim.id,
        invoice_id: claim.invoice.id,
        shop_id: claim.shop.id,
      },
    });

    // Update the guarantee claim as reimbursed
    const updatedClaim = await prisma.guaranteeClaim.update({
      where: { id },
      data: {
        outcome: "REIMBURSED",
        reimbursementAmountCents: amount_cents,
        reimbursedAt: new Date(),
        notes: claim.notes
          ? `${claim.notes}\nReimbursed via transfer ${transfer.id}`
          : `Reimbursed via transfer ${transfer.id}`,
      },
    });

    return NextResponse.json({
      success: true,
      claim: updatedClaim,
      stripeTransferId: transfer.id,
    });
  } catch (error) {
    console.error("POST /api/admin/disputes/[id]/reimburse error:", error);
    return NextResponse.json(
      { error: "Failed to reimburse shop" },
      { status: 500 }
    );
  }
}
