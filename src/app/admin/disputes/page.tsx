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

export default async function AdminDisputesPage() {
  const claims = await prisma.guaranteeClaim.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      shop: { select: { id: true, name: true } },
      invoice: {
        select: {
          id: true,
          customerName: true,
          customerPhone: true,
          totalCents: true,
          status: true,
          paidAt: true,
        },
      },
    },
  });

  const pendingCount = claims.filter((c) => c.outcome === "PENDING").length;
  const wonCount = claims.filter((c) => c.outcome === "WON").length;
  const lostCount = claims.filter((c) => c.outcome === "LOST").length;
  const reimbursedCount = claims.filter(
    (c) => c.outcome === "REIMBURSED"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin"
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Admin
                </Link>
                <span className="text-gray-300">/</span>
                <h1 className="text-2xl font-bold text-gray-900">
                  Dispute Management
                </h1>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                All guarantee claims across all shops
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-yellow-600 uppercase">
              Pending
            </p>
            <p className="text-2xl font-bold text-yellow-800">{pendingCount}</p>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-green-600 uppercase">Won</p>
            <p className="text-2xl font-bold text-green-800">{wonCount}</p>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-red-600 uppercase">Lost</p>
            <p className="text-2xl font-bold text-red-800">{lostCount}</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
            <p className="text-xs font-medium text-blue-600 uppercase">
              Reimbursed
            </p>
            <p className="text-2xl font-bold text-blue-800">
              {reimbursedCount}
            </p>
          </div>
        </div>

        {/* Claims Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              All Claims ({claims.length})
            </h2>
          </div>

          {claims.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No guarantee claims found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-6 py-3">Shop</th>
                    <th className="px-6 py-3">Invoice</th>
                    <th className="px-6 py-3">Dispute Amount</th>
                    <th className="px-6 py-3">Reason Code</th>
                    <th className="px-6 py-3">Category</th>
                    <th className="px-6 py-3">Outcome</th>
                    <th className="px-6 py-3">Evidence</th>
                    <th className="px-6 py-3">Created</th>
                    <th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {claims.map((claim) => (
                    <tr key={claim.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {claim.shop.name}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {claim.invoice.customerName}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">
                          {claim.invoiceId.slice(0, 8)}...
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {formatCents(claim.disputeAmountCents)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {claim.disputeReasonCode ?? "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {claim.disputeCategory ?? "-"}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${outcomeColors[claim.outcome] ?? "bg-gray-100 text-gray-800"}`}
                        >
                          {claim.outcome}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {claim.evidenceSubmittedAt ? (
                          <span className="text-xs text-green-600 font-medium">
                            Submitted
                          </span>
                        ) : claim.evidenceBundlePath ? (
                          <span className="text-xs text-blue-600 font-medium">
                            Compiled
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            Not compiled
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {formatDate(claim.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/disputes/${claim.id}`}
                            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                          >
                            View
                          </Link>
                          {claim.outcome === "PENDING" && (
                            <>
                              <form
                                action={`/api/admin/disputes/${claim.id}/evidence`}
                                method="POST"
                              >
                                <button
                                  type="submit"
                                  className="text-sm text-purple-600 hover:text-purple-800 font-medium"
                                >
                                  Submit Evidence
                                </button>
                              </form>
                              <Link
                                href={`/admin/disputes/${claim.id}#reimburse`}
                                className="text-sm text-orange-600 hover:text-orange-800 font-medium"
                              >
                                Reimburse
                              </Link>
                            </>
                          )}
                        </div>
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
