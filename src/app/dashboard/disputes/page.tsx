import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";

const outcomeConfig: Record<string, { label: string; classes: string }> = {
  PENDING: {
    label: "Pending",
    classes: "bg-yellow-100 text-yellow-700",
  },
  WON: {
    label: "Won",
    classes: "bg-green-100 text-green-700",
  },
  LOST: {
    label: "Lost",
    classes: "bg-red-100 text-red-700",
  },
  REIMBURSED: {
    label: "Reimbursed",
    classes: "bg-purple-100 text-purple-700",
  },
};

export default async function DisputesPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const claims = await prisma.guaranteeClaim.findMany({
    where: { shopId: session.user.shopId },
    orderBy: { createdAt: "desc" },
    include: {
      invoice: {
        select: {
          id: true,
          customerName: true,
          totalCents: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disputes</h1>
        <p className="mt-1 text-sm text-gray-600">
          Guarantee claims and chargeback disputes for your shop.
        </p>
      </div>

      {claims.length === 0 ? (
        <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            No disputes yet
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            When chargeback disputes or guarantee claims are filed, they will
            appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Customer
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                  Reason
                </th>
                <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 md:table-cell">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Outcome
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount
                </th>
                <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                  Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {claims.map((claim) => {
                const outcome = outcomeConfig[claim.outcome] || {
                  label: claim.outcome,
                  classes: "bg-gray-100 text-gray-700",
                };
                return (
                  <tr
                    key={claim.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/invoices/${claim.invoiceId}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {claim.invoice.customerName}
                      </Link>
                      <p className="text-xs text-gray-500">
                        Invoice: {formatCents(claim.invoice.totalCents)}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-gray-600 sm:table-cell">
                      {claim.disputeReasonCode || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-gray-600 md:table-cell">
                      {claim.disputeCategory || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${outcome.classes}`}
                      >
                        {outcome.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCents(claim.disputeAmountCents)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm text-gray-500 sm:table-cell">
                      {new Date(claim.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary cards */}
      {claims.length > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-600">Total Claims</p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {claims.length}
            </p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-600">Pending</p>
            <p className="mt-1 text-2xl font-bold text-yellow-700">
              {claims.filter((c) => c.outcome === "PENDING").length}
            </p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-600">Won</p>
            <p className="mt-1 text-2xl font-bold text-green-700">
              {claims.filter((c) => c.outcome === "WON").length}
            </p>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <p className="text-sm font-medium text-gray-600">
              Total Disputed
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {formatCents(
                claims.reduce((sum, c) => sum + c.disputeAmountCents, 0)
              )}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
