import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

/**
 * POST /api/shops/onboard
 * Creates a Stripe Connect Express account for a shop and returns the onboarding URL.
 * Requires authentication.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { shopId } = body as { shopId: string };

    if (!shopId) {
      return NextResponse.json(
        { error: "shopId is required" },
        { status: 400 }
      );
    }

    // Verify the user belongs to this shop
    if (shopId !== session.user.shopId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch the shop
    const shop = await prisma.shop.findUnique({
      where: { id: shopId },
    });

    if (!shop) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    // If the shop already has a Stripe Connect account, create a new account link for it
    let stripeAccountId = shop.stripeConnectAccountId;

    if (!stripeAccountId) {
      // Create a new Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: "express",
        country: "US",
        email: shop.ownerEmail || shop.email || undefined,
        business_type: "company",
        company: {
          name: shop.name,
          phone: shop.phone || undefined,
        },
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        metadata: {
          shop_id: shopId,
        },
      });

      stripeAccountId = account.id;

      // Save the Stripe account ID to the shop
      await prisma.shop.update({
        where: { id: shopId },
        data: { stripeConnectAccountId: stripeAccountId },
      });
    }

    // Create an account link for onboarding
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${appUrl}/dashboard/settings?stripe=refresh`,
      return_url: `${appUrl}/dashboard/settings?stripe=success`,
      type: "account_onboarding",
    });

    return NextResponse.json({
      url: accountLink.url,
      stripeAccountId,
    });
  } catch (error) {
    console.error("POST /api/shops/onboard error:", error);
    return NextResponse.json(
      { error: "Failed to create onboarding link" },
      { status: 500 }
    );
  }
}
