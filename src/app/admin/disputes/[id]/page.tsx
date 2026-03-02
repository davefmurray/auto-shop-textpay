import { prisma } from "@/lib/prisma";
import { getSignedUrl, STORAGE_BUCKETS } from "@/lib/supabase";
import { notFound } from "next/navigation";
import Link from "next/link";

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

const outcomeColors: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  WON: "bg-green-100 text-green-800",
  LOST: "bg-red-100 text-red-800",
  REIMBURSED: "bg-blue-100 text-blue-800",
};

export default async function DisputeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const claim = await prisma.guaranteeClaim.findUnique({
    where: { id },
    include: {
      shop: {
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          email: true,
          stripeConnectAccountId: true,
        },
      },
      invoice: {
        include: {
          authorization: true,
          workPhotos: {
            include: {
              uploadedBy: { select: { name: true } },
            },
            orderBy: { uploadedAt: "asc" },
          },
          shopApproval: {
            include: {
              approvedBy: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!claim) {
    notFound();
  }

  const { invoice } = claim;
  const authorization = invoice.authorization;
  const shopApproval = invoice.shopApproval;
  const workPhotos = invoice.workPhotos;

  // Generate signed URLs for images
  let dlFrontUrl: string | null = null;
  let signatureUrl: string | null = null;

  if (authorization?.dlFrontImagePath) {
    try {
      dlFrontUrl = await getSignedUrl(
        STORAGE_BUCKETS.DL_IMAGES,
        authorization.dlFrontImagePath
      );
    } catch {
      dlFrontUrl = null;
    }
  }

  if (authorization?.signatureDataPath) {
    try {
      signatureUrl = await getSignedUrl(
        STORAGE_BUCKETS.SIGNATURES,
        authorization.signatureDataPath
      );
    } catch {
      signatureUrl = null;
    }
  }

  // Generate signed URLs for work photos
  const photoUrls: Record<string, string> = {};
  for (const photo of workPhotos) {
    try {
      photoUrls[photo.id] = await getSignedUrl(
        STORAGE_BUCKETS.WORK_PHOTOS,
        photo.imagePath
      );
    } catch {
      photoUrls[photo.id] = "";
    }
  }

  const beforePhotos = workPhotos.filter((p) => p.photoType === "BEFORE");
  const afterPhotos = workPhotos.filter((p) => p.photoType === "AFTER");
  const duringPhotos = workPhotos.filter((p) => p.photoType === "DURING");

  const lineItems = invoice.lineItems as Array<{
    description: string;
    amountCents: number;
    type: string;
  }>;

  const disclaimers = authorization?.disclaimersAccepted as
    | Array<{ text: string; acceptedAt: string }>
    | null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 text-sm text-gray-500 mb-2">
            <Link href="/admin" className="hover:text-gray-700">
              Admin
            </Link>
            <span className="text-gray-300">/</span>
            <Link href="/admin/disputes" className="hover:text-gray-700">
              Disputes
            </Link>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">
              {id.slice(0, 8)}...
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Dispute Detail
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {claim.shop.name} &mdash; {invoice.customerName}
              </p>
            </div>
            <span
              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${outcomeColors[claim.outcome] ?? "bg-gray-100 text-gray-800"}`}
            >
              {claim.outcome}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Action Buttons */}
        {claim.outcome === "PENDING" && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Actions
            </h2>
            <div className="flex flex-wrap gap-4">
              <form
                action={`/api/admin/disputes/${claim.id}/evidence`}
                method="POST"
              >
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
                >
                  Compile Evidence Bundle
                </button>
              </form>

              {claim.evidenceBundlePath && (
                <form
                  action={`/api/admin/disputes/${claim.id}/submit`}
                  method="POST"
                >
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Submit to Stripe
                  </button>
                </form>
              )}

              <form
                action={`/api/admin/disputes/${claim.id}/reimburse`}
                method="POST"
                id="reimburse"
              >
                <input
                  type="hidden"
                  name="amount_cents"
                  value={claim.disputeAmountCents}
                />
                <button
                  type="submit"
                  className="inline-flex items-center px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition-colors"
                >
                  Reimburse Shop ({formatCents(claim.disputeAmountCents)})
                </button>
              </form>
            </div>

            {claim.evidenceBundlePath && (
              <p className="text-xs text-gray-500 mt-3">
                Evidence bundle compiled: {claim.evidenceBundlePath}
              </p>
            )}
            {claim.evidenceSubmittedAt && (
              <p className="text-xs text-green-600 mt-1">
                Evidence submitted to Stripe at{" "}
                {formatDate(claim.evidenceSubmittedAt)}
              </p>
            )}
          </div>
        )}

        {/* Dispute Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Dispute Information
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Claim ID
              </dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {claim.id}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Stripe Dispute ID
              </dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {claim.stripeDisputeId ?? "N/A"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Dispute Amount
              </dt>
              <dd className="mt-1 text-sm font-bold text-red-600">
                {formatCents(claim.disputeAmountCents)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Reason Code
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {claim.disputeReasonCode ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Category
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {claim.disputeCategory ?? "-"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Outcome
              </dt>
              <dd className="mt-1">
                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${outcomeColors[claim.outcome] ?? "bg-gray-100 text-gray-800"}`}
                >
                  {claim.outcome}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Created
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(claim.createdAt)}
              </dd>
            </div>
            {claim.reimbursedAt && (
              <>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Reimbursed Amount
                  </dt>
                  <dd className="mt-1 text-sm font-bold text-blue-600">
                    {formatCents(claim.reimbursementAmountCents ?? 0)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Reimbursed At
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(claim.reimbursedAt)}
                  </dd>
                </div>
              </>
            )}
            {claim.notes && (
              <div className="sm:col-span-2 lg:col-span-3">
                <dt className="text-xs font-medium text-gray-500 uppercase">
                  Notes
                </dt>
                <dd className="mt-1 text-sm text-gray-900 whitespace-pre-wrap">
                  {claim.notes}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Invoice Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Invoice Details
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 mb-6">
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Invoice ID
              </dt>
              <dd className="mt-1 text-sm text-gray-900 font-mono">
                {invoice.id}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Customer
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {invoice.customerName}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Phone
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {invoice.customerPhone}
              </dd>
            </div>
            {invoice.customerEmail && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">
                  Email
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {invoice.customerEmail}
                </dd>
              </div>
            )}
            {invoice.vehicleInfo && (
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">
                  Vehicle
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {Object.values(
                    invoice.vehicleInfo as Record<string, string>
                  ).join(" ")}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Status
              </dt>
              <dd className="mt-1 text-sm text-gray-900">{invoice.status}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500 uppercase">
                Paid At
              </dt>
              <dd className="mt-1 text-sm text-gray-900">
                {formatDate(invoice.paidAt)}
              </dd>
            </div>
          </dl>

          {/* Line Items */}
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            Line Items
          </h3>
          <table className="w-full mb-4">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 uppercase border-b border-gray-200">
                <th className="py-2 pr-4">Description</th>
                <th className="py-2 pr-4">Type</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="py-2 pr-4 text-sm text-gray-900">
                    {item.description}
                  </td>
                  <td className="py-2 pr-4 text-sm text-gray-500">
                    {item.type}
                  </td>
                  <td className="py-2 text-sm text-gray-900 text-right">
                    {formatCents(item.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200">
              <tr>
                <td
                  colSpan={2}
                  className="py-2 text-sm font-medium text-gray-700"
                >
                  Subtotal
                </td>
                <td className="py-2 text-sm text-gray-900 text-right">
                  {formatCents(invoice.subtotalCents)}
                </td>
              </tr>
              <tr>
                <td
                  colSpan={2}
                  className="py-1 text-sm text-gray-500"
                >
                  Convenience Fee
                </td>
                <td className="py-1 text-sm text-gray-600 text-right">
                  {formatCents(invoice.convenienceFeeCents)}
                </td>
              </tr>
              <tr className="border-t border-gray-200">
                <td
                  colSpan={2}
                  className="py-2 text-sm font-bold text-gray-900"
                >
                  Total
                </td>
                <td className="py-2 text-sm font-bold text-gray-900 text-right">
                  {formatCents(invoice.totalCents)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Authorization Evidence */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Authorization Evidence
          </h2>

          {authorization ? (
            <div className="space-y-6">
              <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Payer Name
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">
                    {authorization.payerName}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Payer Is Customer
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {authorization.payerIsCustomer ? "Yes" : "No"}
                  </dd>
                </div>
                {authorization.relationshipToCustomer && (
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase">
                      Relationship
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {authorization.relationshipToCustomer}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Last 4 Entered
                  </dt>
                  <dd className="mt-1 text-sm font-mono text-gray-900">
                    {authorization.lastFourEntered}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Last 4 Matched
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {authorization.lastFourMatched === null
                      ? "Not verified"
                      : authorization.lastFourMatched
                        ? "Matched"
                        : "Did NOT match"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Consent Timestamp
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {formatDate(authorization.consentTimestamp)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    IP Address
                  </dt>
                  <dd className="mt-1 text-sm font-mono text-gray-900">
                    {authorization.ipAddress ?? "Unknown"}
                  </dd>
                </div>
                {authorization.userAgent && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <dt className="text-xs font-medium text-gray-500 uppercase">
                      User Agent
                    </dt>
                    <dd className="mt-1 text-xs font-mono text-gray-600 break-all">
                      {authorization.userAgent}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Authorization Text */}
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Authorization Text
                </h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm text-gray-800">
                    {authorization.authorizationText}
                  </p>
                </div>
              </div>

              {/* Disclaimers */}
              {disclaimers && disclaimers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Disclaimers Accepted
                  </h3>
                  <div className="space-y-2">
                    {disclaimers.map((d, idx) => (
                      <div
                        key={idx}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-3"
                      >
                        <p className="text-sm text-gray-800">{d.text}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Accepted at: {d.acceptedAt}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Identity Images */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Driver&apos;s License
                  </h3>
                  {dlFrontUrl ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={dlFrontUrl}
                        alt="Driver's License Front"
                        className="w-full h-auto"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No DL image uploaded
                    </p>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">
                    Signature
                  </h3>
                  {signatureUrl ? (
                    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={signatureUrl}
                        alt="Customer Signature"
                        className="w-full h-auto"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400">
                      No signature uploaded
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No authorization record found for this invoice.
            </p>
          )}
        </div>

        {/* Work Photos */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Work Documentation
          </h2>

          {workPhotos.length === 0 ? (
            <p className="text-sm text-gray-500">
              No work photos uploaded for this invoice.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Before Photos */}
              {beforePhotos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    Before Photos ({beforePhotos.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {beforePhotos.map((photo) => (
                      <div key={photo.id} className="space-y-1">
                        {photoUrls[photo.id] ? (
                          <div className="border border-gray-200 rounded-lg overflow-hidden aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrls[photo.id]}
                              alt={photo.description ?? "Before photo"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="border border-gray-200 rounded-lg aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            No image
                          </div>
                        )}
                        {photo.description && (
                          <p className="text-xs text-gray-600">
                            {photo.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDate(photo.takenAt ?? photo.uploadedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* During Photos */}
              {duringPhotos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    During Photos ({duringPhotos.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {duringPhotos.map((photo) => (
                      <div key={photo.id} className="space-y-1">
                        {photoUrls[photo.id] ? (
                          <div className="border border-gray-200 rounded-lg overflow-hidden aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrls[photo.id]}
                              alt={photo.description ?? "During photo"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="border border-gray-200 rounded-lg aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            No image
                          </div>
                        )}
                        {photo.description && (
                          <p className="text-xs text-gray-600">
                            {photo.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDate(photo.takenAt ?? photo.uploadedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* After Photos */}
              {afterPhotos.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">
                    After Photos ({afterPhotos.length})
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {afterPhotos.map((photo) => (
                      <div key={photo.id} className="space-y-1">
                        {photoUrls[photo.id] ? (
                          <div className="border border-gray-200 rounded-lg overflow-hidden aspect-square">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={photoUrls[photo.id]}
                              alt={photo.description ?? "After photo"}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="border border-gray-200 rounded-lg aspect-square bg-gray-100 flex items-center justify-center text-gray-400 text-xs">
                            No image
                          </div>
                        )}
                        {photo.description && (
                          <p className="text-xs text-gray-600">
                            {photo.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-400">
                          {formatDate(photo.takenAt ?? photo.uploadedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Shop Approval */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Shop Approval Record
          </h2>

          {shopApproval ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">
                  Decision
                </dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      shopApproval.decision === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {shopApproval.decision}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">
                  Approved By
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {shopApproval.approvedBy.name}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-gray-500 uppercase">
                  Decided At
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {formatDate(shopApproval.decidedAt)}
                </dd>
              </div>
              {shopApproval.notes && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Notes
                  </dt>
                  <dd className="mt-1 text-sm text-gray-900">
                    {shopApproval.notes}
                  </dd>
                </div>
              )}
              {shopApproval.rejectionReason && (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-medium text-gray-500 uppercase">
                    Rejection Reason
                  </dt>
                  <dd className="mt-1 text-sm text-red-600">
                    {shopApproval.rejectionReason}
                  </dd>
                </div>
              )}
            </dl>
          ) : (
            <p className="text-sm text-gray-500">
              No shop approval record found for this invoice.
            </p>
          )}
        </div>

        {/* SMS Timeline */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Event Timeline
          </h2>
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
            <div className="space-y-6">
              <TimelineEvent
                label="Invoice Created"
                date={formatDate(invoice.createdAt)}
              />
              {invoice.sentAt && (
                <TimelineEvent
                  label="SMS Sent to Customer"
                  date={formatDate(invoice.sentAt)}
                />
              )}
              {invoice.viewedAt && (
                <TimelineEvent
                  label="Customer Viewed Invoice"
                  date={formatDate(invoice.viewedAt)}
                />
              )}
              {invoice.customerAuthorizedAt && (
                <TimelineEvent
                  label="Customer Authorized Payment"
                  date={formatDate(invoice.customerAuthorizedAt)}
                  detail={
                    authorization
                      ? `Payer: ${authorization.payerName}`
                      : undefined
                  }
                />
              )}
              {invoice.shopApprovedAt && (
                <TimelineEvent
                  label="Shop Approved"
                  date={formatDate(invoice.shopApprovedAt)}
                  detail={
                    shopApproval
                      ? `By: ${shopApproval.approvedBy.name}`
                      : undefined
                  }
                />
              )}
              {invoice.paidAt && (
                <TimelineEvent
                  label="Payment Captured"
                  date={formatDate(invoice.paidAt)}
                  detail={formatCents(invoice.totalCents)}
                />
              )}
              <TimelineEvent
                label="Dispute Filed"
                date={formatDate(claim.createdAt)}
                detail={`${claim.disputeReasonCode ?? "Unknown reason"} - ${formatCents(claim.disputeAmountCents)}`}
                isAlert
              />
              {claim.evidenceSubmittedAt && (
                <TimelineEvent
                  label="Evidence Submitted to Stripe"
                  date={formatDate(claim.evidenceSubmittedAt)}
                />
              )}
              {claim.reimbursedAt && (
                <TimelineEvent
                  label="Shop Reimbursed"
                  date={formatDate(claim.reimbursedAt)}
                  detail={formatCents(claim.reimbursementAmountCents ?? 0)}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function TimelineEvent({
  label,
  date,
  detail,
  isAlert,
}: {
  label: string;
  date: string;
  detail?: string;
  isAlert?: boolean;
}) {
  return (
    <div className="relative flex items-start pl-10">
      <div
        className={`absolute left-2.5 w-3 h-3 rounded-full border-2 ${
          isAlert
            ? "bg-red-500 border-red-600"
            : "bg-white border-gray-400"
        }`}
      ></div>
      <div>
        <p
          className={`text-sm font-medium ${isAlert ? "text-red-700" : "text-gray-900"}`}
        >
          {label}
        </p>
        <p className="text-xs text-gray-500">{date}</p>
        {detail && <p className="text-xs text-gray-600 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}
