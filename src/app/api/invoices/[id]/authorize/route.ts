import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadFile, STORAGE_BUCKETS } from "@/lib/supabase";
import { createManualCaptureIntent, calculateGuaranteeFee } from "@/lib/stripe";
import { v4 as uuidv4 } from "uuid";

/**
 * POST /api/invoices/[id]/authorize
 * Public route — called from the customer payment page.
 * Processes customer authorization, uploads documents, creates a Stripe PaymentIntent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Parse the multipart form data
    const formData = await request.formData();

    const payerName = formData.get("payerName") as string;
    const payerIsCustomer = formData.get("payerIsCustomer") === "true";
    const relationship = formData.get("relationship") as string | null;
    const lastFourEntered = formData.get("lastFourEntered") as string;
    const authorizationText = formData.get("authorizationText") as string;
    const disclaimersAcceptedRaw = formData.get("disclaimersAccepted") as string;
    const signatureData = formData.get("signatureData") as string;
    const dlImage = formData.get("dlImage") as File | null;

    // Validate required fields
    if (!payerName || !lastFourEntered || !authorizationText || !signatureData) {
      return NextResponse.json(
        {
          error:
            "payerName, lastFourEntered, authorizationText, and signatureData are required",
        },
        { status: 400 }
      );
    }

    // Parse disclaimers
    let disclaimersAccepted: Array<{ text: string; acceptedAt: string }>;
    try {
      disclaimersAccepted = JSON.parse(disclaimersAcceptedRaw || "[]");
    } catch {
      disclaimersAccepted = [];
    }

    // Fetch the invoice with shop details
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        shop: {
          select: {
            id: true,
            name: true,
            stripeConnectAccountId: true,
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

    if (
      invoice.status !== "SENT" &&
      invoice.status !== "VIEWED"
    ) {
      return NextResponse.json(
        {
          error: `Cannot authorize invoice with status ${invoice.status}`,
        },
        { status: 400 }
      );
    }

    if (!invoice.shop.stripeConnectAccountId) {
      return NextResponse.json(
        { error: "Shop has not completed Stripe onboarding" },
        { status: 400 }
      );
    }

    // Upload DL image to Supabase Storage
    let dlFrontImagePath: string | null = null;
    if (dlImage) {
      const dlBuffer = Buffer.from(await dlImage.arrayBuffer());
      const dlExt = dlImage.name.split(".").pop() || "jpg";
      const dlPath = `${invoice.shopId}/${id}/${uuidv4()}.${dlExt}`;
      dlFrontImagePath = await uploadFile(
        STORAGE_BUCKETS.DL_IMAGES,
        dlPath,
        dlBuffer,
        dlImage.type || "image/jpeg"
      );
    }

    // Convert signature data URL to buffer and upload
    let signatureDataPath: string | null = null;
    if (signatureData) {
      // signatureData is a base64 data URL like "data:image/png;base64,..."
      const matches = signatureData.match(
        /^data:([^;]+);base64,(.+)$/
      );
      if (matches) {
        const contentType = matches[1];
        const base64Data = matches[2];
        const signatureBuffer = Buffer.from(base64Data, "base64");
        const sigExt = contentType.split("/")[1] || "png";
        const sigPath = `${invoice.shopId}/${id}/${uuidv4()}.${sigExt}`;
        signatureDataPath = await uploadFile(
          STORAGE_BUCKETS.SIGNATURES,
          sigPath,
          signatureBuffer,
          contentType
        );
      }
    }

    // Get IP address and user-agent
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    // Create the Authorization record
    const authorization = await prisma.authorization.create({
      data: {
        invoiceId: id,
        payerName,
        payerIsCustomer,
        relationshipToCustomer: relationship || null,
        dlFrontImagePath,
        lastFourEntered,
        signatureDataPath,
        authorizationText,
        disclaimersAccepted,
        ipAddress,
        userAgent,
        consentTimestamp: new Date(),
      },
    });

    // Calculate the guarantee fee
    const guaranteeFeeCents = invoice.shop.guaranteeActive
      ? calculateGuaranteeFee(invoice.subtotalCents)
      : 0;

    // Create Stripe PaymentIntent with manual capture
    const paymentIntent = await createManualCaptureIntent({
      amountCents: invoice.totalCents,
      shopStripeAccountId: invoice.shop.stripeConnectAccountId,
      guaranteeFeeCents,
      invoiceId: id,
      payerName,
      customerName: invoice.customerName,
    });

    // Update the invoice
    await prisma.invoice.update({
      where: { id },
      data: {
        status: "CUSTOMER_AUTHORIZED",
        customerAuthorizedAt: new Date(),
        stripePaymentIntentId: paymentIntent.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day hold expiry
      },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      authorizationId: authorization.id,
    });
  } catch (error) {
    console.error("POST /api/invoices/[id]/authorize error:", error);
    return NextResponse.json(
      { error: "Failed to authorize payment" },
      { status: 500 }
    );
  }
}
