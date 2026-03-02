export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatCents } from "@/lib/utils";
import Link from "next/link";
import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const shopId = session!.user.shopId;

  // Get stats
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalInvoices,
    pendingApprovals,
    paidThisMonth,
    totalRevenueResult,
    recentInvoices,
    pendingInvoices,
  ] = await Promise.all([
    prisma.invoice.count({
      where: { shopId },
    }),
    prisma.invoice.count({
      where: { shopId, status: "CUSTOMER_AUTHORIZED" },
    }),
    prisma.invoice.count({
      where: {
        shopId,
        status: "PAID",
        paidAt: { gte: startOfMonth },
      },
    }),
    prisma.invoice.aggregate({
      where: { shopId, status: "PAID" },
      _sum: { totalCents: true },
    }),
    prisma.invoice.findMany({
      where: { shopId },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        createdBy: { select: { name: true } },
      },
    }),
    prisma.invoice.findMany({
      where: { shopId, status: "CUSTOMER_AUTHORIZED" },
      orderBy: { customerAuthorizedAt: "asc" },
      include: {
        authorization: {
          select: { payerName: true, consentTimestamp: true },
        },
      },
    }),
  ]);

  const totalRevenue = totalRevenueResult._sum.totalCents || 0;

  const stats = [
    { label: "Total Invoices", value: totalInvoices.toString() },
    {
      label: "Pending Approval",
      value: pendingApprovals.toString(),
      highlight: pendingApprovals > 0,
    },
    { label: "Paid This Month", value: paidThisMonth.toString() },
    { label: "Total Revenue", value: formatCents(totalRevenue) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Overview of your shop activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className={`rounded-xl bg-white p-5 shadow-sm ring-1 ${
              stat.highlight
                ? "ring-orange-200 bg-orange-50"
                : "ring-gray-200"
            }`}
          >
            <p className="text-sm font-medium text-gray-600">{stat.label}</p>
            <p
              className={`mt-1 text-2xl font-bold ${
                stat.highlight ? "text-orange-700" : "text-gray-900"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Pending Approval Section */}
      {pendingInvoices.length > 0 && (
        <div className="rounded-xl bg-orange-50 p-6 ring-1 ring-orange-200">
          <h2 className="text-lg font-semibold text-orange-900">
            Pending Approval ({pendingInvoices.length})
          </h2>
          <p className="mt-1 text-sm text-orange-700">
            These invoices have been authorized by the customer and need your
            review.
          </p>
          <div className="mt-4 space-y-3">
            {pendingInvoices.map((invoice) => (
              <Link
                key={invoice.id}
                href={`/dashboard/invoices/${invoice.id}/approve`}
                className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm ring-1 ring-orange-100 transition-shadow hover:shadow-md"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    {invoice.customerName}
                  </p>
                  <p className="text-sm text-gray-600">
                    {invoice.authorization?.payerName &&
                      `Authorized by ${invoice.authorization.payerName}`}
                    {invoice.authorization?.consentTimestamp &&
                      ` on ${new Date(
                        invoice.authorization.consentTimestamp
                      ).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    {formatCents(invoice.totalCents)}
                  </p>
                  <p className="text-sm text-orange-600">Review &rarr;</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            Recent Invoices
          </h2>
          <Link
            href="/dashboard/invoices/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            New Invoice
          </Link>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm ring-1 ring-gray-200">
            <p className="text-gray-500">No invoices yet.</p>
            <Link
              href="/dashboard/invoices/new"
              className="mt-2 inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Create your first invoice
            </Link>
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
                    Created By
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                    Total
                  </th>
                  <th className="hidden px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 sm:table-cell">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {recentInvoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/invoices/${invoice.id}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                      >
                        {invoice.customerName}
                      </Link>
                      <p className="text-xs text-gray-500">
                        {invoice.customerPhone}
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 text-sm text-gray-600 sm:table-cell">
                      {invoice.createdBy?.name || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                      {formatCents(invoice.totalCents)}
                    </td>
                    <td className="hidden px-4 py-3 text-right text-sm text-gray-500 sm:table-cell">
                      {new Date(invoice.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
