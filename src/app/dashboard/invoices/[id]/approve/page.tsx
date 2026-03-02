export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl, STORAGE_BUCKETS } from "@/lib/supabase";
import { formatCents } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import ApprovalActions from "@/components/dashboard/ApprovalActions";

interface DisclaimerAccepted {
  text: string;
  acceptedAt: string;
}

export default async function ApprovePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    include: {
      shop: { select: { name: true } },
      authorization: true,
      workPhotos: {
        where: { photoType: "BEFORE" },
        orderBy: { uploadedAt: "asc" },
      },
    },
  });

  if (!invoice || invoice.shopId !== session.user.shopId) {
    redirect("/dashboard");
  }

  if (invoice.status !== "CUSTOMER_AUTHORIZED") {
    redirect(`/dashboard/invoices/${id}`);
  }

  // Generate signed URLs for evidence
  let dlFrontUrl = "";
  let dlBackUrl = "";
  let signatureUrl = "";

  if (invoice.authorization) {
    if (invoice.authorization.dlFrontImagePath) {
      try {
        dlFrontUrl = await getSignedUrl(
          STORAGE_BUCKETS.DL_IMAGES,
          invoice.authorization.dlFrontImagePath
        );
      } catch {
        /* ignore */
      }
    }
    if (invoice.authorization.dlBackImagePath) {
      try {
        dlBackUrl = await getSignedUrl(
          STORAGE_BUCKETS.DL_IMAGES,
          invoice.authorization.dlBackImagePath
        );
      } catch {
        /* ignore */
      }
    }
    if (invoice.authorization.signatureDataPath) {
      try {
        signatureUrl = await getSignedUrl(
          STORAGE_BUCKETS.SIGNATURES,
          invoice.authorization.signatureDataPath
        );
      } catch {
        /* ignore */
      }
    }
  }

  // Generate signed URLs for before photos
  const beforePhotoUrls: Record<string, string> = {};
  for (const photo of invoice.workPhotos) {
    try {
      beforePhotoUrls[photo.id] = await getSignedUrl(
        STORAGE_BUCKETS.WORK_PHOTOS,
        photo.imagePath
      );
    } catch {
      beforePhotoUrls[photo.id] = "";
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Review &amp; Approve
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Review the authorization evidence before approving this invoice.
          </p>
        </div>
        <Link
          href={`/dashboard/invoices/${id}`}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to Invoice
        </Link>
      </div>

      {/* Invoice Summary */}
      <div className="rounded-xl bg-blue-50 p-6 ring-1 ring-blue-200">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-blue-700">Invoice for</p>
            <p className="text-lg font-bold text-blue-900">
              {invoice.customerName}
            </p>
            <p className="text-sm text-blue-700">{invoice.customerPhone}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-blue-700">Total Amount</p>
            <p className="text-2xl font-bold text-blue-900">
              {formatCents(invoice.totalCents)}
            </p>
          </div>
        </div>
      </div>

      {/* Authorization Evidence */}
      {invoice.authorization && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Authorization Evidence
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Payer Details */}
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500">Payer Name</p>
                <p className="text-sm font-medium text-gray-900">
                  {invoice.authorization.payerName}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Is Customer</p>
                <p className="text-sm font-medium text-gray-900">
                  {invoice.authorization.payerIsCustomer ? "Yes" : "No"}
                  {invoice.authorization.relationshipToCustomer &&
                    ` (${invoice.authorization.relationshipToCustomer})`}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Card Last Four</p>
                <p className="font-mono text-sm font-medium text-gray-900">
                  **** {invoice.authorization.lastFourEntered}
                </p>
              </div>
              {invoice.authorization.lastFourMatched !== null && (
                <div>
                  <p className="text-sm text-gray-500">Card Match</p>
                  <p className="text-sm font-medium">
                    {invoice.authorization.lastFourMatched ? (
                      <span className="text-green-700">Matched</span>
                    ) : (
                      <span className="text-red-700">Did not match</span>
                    )}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-gray-500">Consent Timestamp</p>
                <p className="text-sm font-medium text-gray-900">
                  {new Date(
                    invoice.authorization.consentTimestamp
                  ).toLocaleString()}
                </p>
              </div>
              {invoice.authorization.ipAddress && (
                <div>
                  <p className="text-sm text-gray-500">IP Address</p>
                  <p className="font-mono text-sm text-gray-900">
                    {invoice.authorization.ipAddress}
                  </p>
                </div>
              )}
              {invoice.authorization.userAgent && (
                <div>
                  <p className="text-sm text-gray-500">Device</p>
                  <p className="text-xs text-gray-600 break-all">
                    {invoice.authorization.userAgent}
                  </p>
                </div>
              )}
            </div>

            {/* Images */}
            <div className="space-y-4">
              {dlFrontUrl && (
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    Driver&apos;s License (Front)
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dlFrontUrl}
                    alt="DL Front"
                    className="max-h-56 rounded-lg border border-gray-200 object-contain"
                  />
                </div>
              )}
              {dlBackUrl && (
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    Driver&apos;s License (Back)
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dlBackUrl}
                    alt="DL Back"
                    className="max-h-56 rounded-lg border border-gray-200 object-contain"
                  />
                </div>
              )}
              {signatureUrl && (
                <div>
                  <p className="mb-1 text-sm font-medium text-gray-700">
                    Signature
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signatureUrl}
                    alt="Signature"
                    className="max-h-28 rounded-lg border border-gray-200 bg-white object-contain p-2"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Authorization Text */}
          {invoice.authorization.authorizationText && (
            <div className="mt-4 rounded-lg bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Authorization Text
              </p>
              <p className="mt-1 text-sm text-gray-700">
                {invoice.authorization.authorizationText}
              </p>
            </div>
          )}

          {/* Disclaimers */}
          {invoice.authorization.disclaimersAccepted && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                Disclaimers Accepted
              </p>
              <ul className="space-y-1">
                {(
                  invoice.authorization.disclaimersAccepted as unknown as DisclaimerAccepted[]
                ).map((d, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-600"
                  >
                    <svg
                      className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m4.5 12.75 6 6 9-13.5"
                      />
                    </svg>
                    <span>
                      {d.text}
                      {d.acceptedAt && (
                        <span className="ml-1 text-xs text-gray-400">
                          ({new Date(d.acceptedAt).toLocaleString()})
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Before Photos Gallery */}
      {invoice.workPhotos.length > 0 && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Before Photos ({invoice.workPhotos.length})
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {invoice.workPhotos.map((photo) => (
              <div key={photo.id}>
                {beforePhotoUrls[photo.id] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={beforePhotoUrls[photo.id]}
                    alt={photo.description || "Before photo"}
                    className="aspect-square w-full rounded-lg border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                    <span className="text-xs text-gray-400">No preview</span>
                  </div>
                )}
                {photo.description && (
                  <p className="mt-1 truncate text-xs text-gray-500">
                    {photo.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Approval Actions (client component) */}
      <ApprovalActions invoiceId={id} />
    </div>
  );
}
