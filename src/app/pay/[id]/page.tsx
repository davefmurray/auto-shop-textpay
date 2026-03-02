export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { PaymentFlow } from "@/components/pay/PaymentFlow";

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: { shop: true },
  });

  if (!invoice || invoice.status === "PAID" || invoice.status === "REFUNDED") {
    notFound();
  }

  // Mark as viewed
  if (invoice.status === "SENT") {
    await prisma.invoice.update({
      where: { id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
  }

  // If already authorized, show pending screen
  if (invoice.status === "CUSTOMER_AUTHORIZED" || invoice.status === "SHOP_APPROVED") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4">&#9203;</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Authorization Held</h1>
          <p className="text-gray-600">
            Your card has been authorized for ${(invoice.totalCents / 100).toFixed(2)}.
            You will NOT be charged until {invoice.shop.name} confirms your service.
          </p>
          <p className="text-gray-500 text-sm mt-4">
            You&apos;ll receive a text when your payment is finalized.
          </p>
        </div>
      </div>
    );
  }

  return (
    <PaymentFlow
      invoice={{
        id: invoice.id,
        customerName: invoice.customerName,
        vehicleInfo: invoice.vehicleInfo as Record<string, string> | null,
        lineItems: invoice.lineItems as Array<{ description: string; amountCents: number; type: string }>,
        subtotalCents: invoice.subtotalCents,
        convenienceFeeCents: invoice.convenienceFeeCents,
        totalCents: invoice.totalCents,
        shopName: invoice.shop.name,
        shopId: invoice.shopId,
      }}
    />
  );
}
