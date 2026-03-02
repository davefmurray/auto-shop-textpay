import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { compileEvidenceBundle } from "@/lib/evidence";

/**
 * POST /api/admin/disputes/[id]/submit
 * Submits compiled evidence to Stripe for a dispute.
 * Maps our evidence fields to Stripe's dispute evidence format.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Fetch the guarantee claim with invoice data
    const claim = await prisma.guaranteeClaim.findUnique({
      where: { id },
      include: {
        invoice: {
          select: {
            id: true,
            customerName: true,
            customerEmail: true,
            paidAt: true,
            lineItems: true,
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

    if (!claim.stripeDisputeId) {
      return NextResponse.json(
        { error: "No Stripe dispute ID associated with this claim" },
        { status: 400 }
      );
    }

    // Compile evidence to get the latest data
    const evidence = await compileEvidenceBundle(claim.invoiceId);

    // Build the line items description for service documentation
    const lineItems = claim.invoice.lineItems as Array<{
      description: string;
      amountCents: number;
      type: string;
    }>;
    const serviceDescription = lineItems
      .map(
        (item) =>
          `${item.description}: $${(item.amountCents / 100).toFixed(2)}`
      )
      .join("\n");

    // Build the combined authorization and disclaimer text
    const authTexts: string[] = [];
    if (evidence.authorization) {
      authTexts.push(
        `Authorization: ${evidence.authorization.authorizationText}`
      );
      authTexts.push(
        `Consent timestamp: ${evidence.authorization.consentTimestamp}`
      );
      authTexts.push(
        `Payer: ${evidence.authorization.payerName} (${evidence.authorization.payerIsCustomer ? "is customer" : `relationship: ${evidence.authorization.relationshipToCustomer}`})`
      );

      if (evidence.authorization.disclaimersAccepted) {
        authTexts.push("\nDisclaimers accepted:");
        for (const disclaimer of evidence.authorization.disclaimersAccepted) {
          authTexts.push(`- ${disclaimer.text} (at ${disclaimer.acceptedAt})`);
        }
      }

      if (evidence.authorization.ipAddress) {
        authTexts.push(`\nIP Address: ${evidence.authorization.ipAddress}`);
      }
      if (evidence.authorization.userAgent) {
        authTexts.push(`User Agent: ${evidence.authorization.userAgent}`);
      }
    }

    if (evidence.identityVerification) {
      authTexts.push(
        `\nCard last 4 entered: ${evidence.identityVerification.lastFourEntered}`
      );
      if (evidence.identityVerification.lastFourMatched !== null) {
        authTexts.push(
          `Card last 4 matched: ${evidence.identityVerification.lastFourMatched ? "Yes" : "No"}`
        );
      }
    }

    if (evidence.shopApproval) {
      authTexts.push(
        `\nShop approval: ${evidence.shopApproval.decision} by ${evidence.shopApproval.approvedByStaffName} at ${evidence.shopApproval.decidedAt}`
      );
      if (evidence.shopApproval.notes) {
        authTexts.push(`Approval notes: ${evidence.shopApproval.notes}`);
      }
    }

    // Submit evidence to Stripe
    const stripeEvidence: Record<string, string> = {
      customer_name: evidence.authorization?.payerName || claim.invoice.customerName,
      service_documentation: `Services performed:\n${serviceDescription}\n\nTotal: $${(claim.invoice.totalCents / 100).toFixed(2)}`,
      uncategorized_text: authTexts.join("\n"),
    };

    if (claim.invoice.customerEmail) {
      stripeEvidence.customer_email_address = claim.invoice.customerEmail;
    }

    if (claim.invoice.paidAt) {
      stripeEvidence.service_date = claim.invoice.paidAt
        .toISOString()
        .split("T")[0];
    }

    if (evidence.authorization?.ipAddress) {
      stripeEvidence.access_activity_log = `Payment authorized from IP: ${evidence.authorization.ipAddress} at ${evidence.authorization.consentTimestamp}`;
    }

    await stripe.disputes.update(claim.stripeDisputeId, {
      evidence: stripeEvidence,
    });

    // Update the claim with evidence submission timestamp
    await prisma.guaranteeClaim.update({
      where: { id },
      data: {
        evidenceSubmittedAt: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      stripeDisputeId: claim.stripeDisputeId,
      evidenceSubmittedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("POST /api/admin/disputes/[id]/submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit evidence to Stripe" },
      { status: 500 }
    );
  }
}
