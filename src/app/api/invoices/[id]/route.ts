import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invoices/[id]
 * Public route — returns a single invoice with limited shop data.
 * Used by the customer-facing payment page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
          },
        },
        authorization: {
          select: {
            id: true,
            payerName: true,
            payerIsCustomer: true,
            consentTimestamp: true,
          },
        },
        workPhotos: {
          select: {
            id: true,
            photoType: true,
            description: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: "asc" },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found" },
        { status: 404 }
      );
    }

    // Mark as viewed if it's the first time
    if (invoice.status === "SENT" && !invoice.viewedAt) {
      await prisma.invoice.update({
        where: { id },
        data: {
          status: "VIEWED",
          viewedAt: new Date(),
        },
      });
      invoice.status = "VIEWED";
      invoice.viewedAt = new Date();
    }

    return NextResponse.json({ invoice });
  } catch (error) {
    console.error("GET /api/invoices/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoice" },
      { status: 500 }
    );
  }
}
