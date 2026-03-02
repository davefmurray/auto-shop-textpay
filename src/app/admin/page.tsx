import { prisma } from "@/lib/prisma";
import Link from "next/link";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | null): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const outcomeColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
  REIMBURSED: "bg-blue-100 text-blue-800",
};

export default async function AdminDashboard() {
  const [shopCount, transactionData, activeDisputeCount, recentClaims] =
    await Promise.all([
      prisma.shop.count(),
      prisma.invoice.aggregate({
        where: { status: "PAID" },
        _count: { id: true },
        _sum: { totalCents: true },
      }),
      prisma.guaranteeClaim.count({
        where: { outcome: "PENDING" },
      }),
      prisma.guaranteeClaim.findMany({
        take: 20,
        orderBy: { createdAt: "desc" },
        include: {
          shop: { select: { name: true } },
          invoice: {
            select: {
              id: true,
              customerName: true,
              totalCents: true,
              paidAt: true,
            },
          },
        },
      }),
    ]);

  const totalTransactions = transactionData._count.id;
  const totalVolumeCents = transactionData._sum.totalCents ?? 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                TextPay Admin
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                Platform overview and dispute management
              </p>
            </div>
            <Link
              href="/admin/disputes"
              className="inline-flex items-center px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
            >
              View All Disputes
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-500">Total Shops</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {shopCount}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-500">
              Total Transactions
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {totalTransactions}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-500">
              Transaction Volume
            </p>
            <p className="text-3xl font-bold text-gray-900 mt-2">
              {formatCents(totalVolumeCents)}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <p className="text-sm font-medium text-gray-500">
              Active Disputes
            </p>
            <p className="text-3xl font-bold text-red-600 mt-2">
              {activeDisputeCount}
            </p>
          </div>
        </div>

        {/* Recent Guarantee Claims */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                Recent Guarantee Claims
              </h2>
              <Link
                href="/admin/disputes"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View all
              </Link>
            </div>
          </div>

          {recentClaims.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No guarantee claims yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Shop</th>
                    <th className="px-6 py-3">Customer</th>
                    <th className="px-6 py-3">Invoice Total</th>
                    <th className="px-6 py-3">Dispute Amount</th>
                    <th className="px-6 py-3">Reason</th>
                    <th className="px-6 py-3">Outcome</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {recentClaims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {claim.shop.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {claim.invoice.customerName}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatCents(claim.invoice.totalCents)}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {formatCents(claim.disputeAmountCents)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {claim.disputeReasonCode ?? "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${outcomeColors[claim.outcome] ?? "bg-gray-100 text-gray-800"}`}
                        >
                          {claim.outcome}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(claim.createdAt)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/admin/disputes/${claim.id}`}
                          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
