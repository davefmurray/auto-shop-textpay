import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPaymentLink } from "@/lib/twilio";

/**
 * POST /api/invoices/[id]/send
 * Sends an SMS payment link to the customer and updates invoice status to SENT.
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

    // Fetch the invoice and verify shop ownership
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        shop: {
          select: { id: true, name: true },
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

    if (invoice.status !== "DRAFT" && invoice.status !== "SENT") {
      return NextResponse.json(
        {
          error: `Cannot send invoice with status ${invoice.status}`,
        },
        { status: 400 }
      );
    }

    // Send the SMS
    await sendPaymentLink({
      to: invoice.customerPhone,
      shopName: invoice.shop.name,
      invoiceId: invoice.id,
      totalCents: invoice.totalCents,
    });

    // Update invoice status and sentAt timestamp
    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    return NextResponse.json({ invoice: updatedInvoice });
  } catch (error) {
    console.error("POST /api/invoices/[id]/send error:", error);
    return NextResponse.json(
      { error: "Failed to send invoice" },
      { status: 500 }
    );
  }
}
