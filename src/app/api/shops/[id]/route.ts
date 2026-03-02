import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/shops/[id]
 * Returns shop details for the authenticated user's shop.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (id !== session.user.shopId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shop = await prisma.shop.findUnique({
      where: { id },
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    return NextResponse.json({ shop });
  } catch (error) {
    console.error("GET /api/shops/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shop" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/shops/[id]
 * Updates shop details for the authenticated user's shop.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    if (id !== session.user.shopId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { name, address, phone, email, convenienceFeeCents } = body as {
      name?: string;
      address?: string;
      phone?: string;
      email?: string;
      convenienceFeeCents?: number;
    };

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (convenienceFeeCents !== undefined) {
      updateData.convenienceFeeCents = convenienceFeeCents;
    }

    const shop = await prisma.shop.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ shop });
  } catch (error) {
    console.error("PATCH /api/shops/[id] error:", error);
    return NextResponse.json(
      { error: "Failed to update shop" },
      { status: 500 }
    );
  }
}
