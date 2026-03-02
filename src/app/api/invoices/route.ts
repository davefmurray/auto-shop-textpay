import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/invoices
 * Lists invoices for the authenticated shop.
 * Supports ?status=DRAFT,SENT query param to filter by status.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");

    const where: Record<string, unknown> = {
      shopId: session.user.shopId,
    };

    if (statusParam) {
      const statuses = statusParam.split(",").map((s) => s.trim());
      where.status = { in: statuses };
    }

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        authorization: {
          select: {
            id: true,
            payerName: true,
            payerIsCustomer: true,
            consentTimestamp: true,
          },
        },
        shopApproval: {
          select: {
            id: true,
            decision: true,
            decidedAt: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            workPhotos: true,
          },
        },
      },
    });

    return NextResponse.json({ invoices });
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json(
      { error: "Failed to fetch invoices" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/invoices
 * Creates a new invoice for the authenticated shop.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      customerName,
      customerPhone,
      customerEmail,
      vehicleInfo,
      description,
      lineItems,
    } = body as {
      customerName: string;
      customerPhone: string;
      customerEmail?: string;
      vehicleInfo?: {
        year: string;
        make: string;
        model: string;
        vin?: string;
        mileage?: string;
      };
      description?: string;
      lineItems: Array<{
        description: string;
        amountCents: number;
        type: "labor" | "parts" | "diagnostic" | "other";
      }>;
    };

    if (!customerName || !customerPhone || !lineItems?.length) {
      return NextResponse.json(
        { error: "customerName, customerPhone, and lineItems are required" },
        { status: 400 }
      );
    }

    // Calculate subtotal from line items
    const subtotalCents = lineItems.reduce(
      (sum, item) => sum + item.amountCents,
      0
    );

    if (subtotalCents <= 0) {
      return NextResponse.json(
        { error: "Total must be greater than zero" },
        { status: 400 }
      );
    }

    // Get the shop's convenience fee setting
    const shop = await prisma.shop.findUnique({
      where: { id: session.user.shopId },
      select: { convenienceFeeCents: true },
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const convenienceFeeCents = shop.convenienceFeeCents;
    const totalCents = subtotalCents + convenienceFeeCents;

    const invoice = await prisma.invoice.create({
      data: {
        shopId: session.user.shopId,
        createdByStaffId: session.user.id,
        customerName,
        customerPhone,
        customerEmail: customerEmail || null,
        vehicleInfo: vehicleInfo || undefined,
        description: description || null,
        lineItems,
        subtotalCents,
        convenienceFeeCents,
        totalCents,
        status: "DRAFT",
      },
    });

    return NextResponse.json({ invoice }, { status: 201 });
  } catch (error) {
    console.error("POST /api/invoices error:", error);
    return NextResponse.json(
      { error: "Failed to create invoice" },
      { status: 500 }
    );
  }
}
