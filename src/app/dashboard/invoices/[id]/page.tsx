export const dynamic = "force-dynamic";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSignedUrl, STORAGE_BUCKETS } from "@/lib/supabase";
import { formatCents } from "@/lib/utils";
import { redirect } from "next/navigation";
import Link from "next/link";
import InvoiceStatusBadge from "@/components/dashboard/InvoiceStatusBadge";
import SendTextButton from "@/components/dashboard/SendTextButton";

interface LineItem {
  description: string;
  amountCents: number;
  type: string;
}

interface VehicleInfo {
  year?: string;
  make?: string;
  model?: string;
  vin?: string;
  mileage?: string;
}

interface DisclaimerAccepted {
  text: string;
  acceptedAt: string;
}

export default async function InvoiceDetailPage({
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
      shop: {
        select: { id: true, name: true },
      },
      createdBy: {
        select: { name: true },
      },
      authorization: true,
      workPhotos: {
        orderBy: { uploadedAt: "asc" },
        include: {
          uploadedBy: { select: { name: true } },
        },
      },
      shopApproval: {
        include: {
          approvedBy: { select: { name: true } },
        },
      },
    },
  });

  if (!invoice || invoice.shopId !== session.user.shopId) {
    redirect("/dashboard");
  }

  const lineItems = invoice.lineItems as unknown as LineItem[];
  const vehicleInfo = invoice.vehicleInfo as unknown as VehicleInfo | null;

  // Generate signed URLs for images
  const photoUrls: Record<string, string> = {};
  for (const photo of invoice.workPhotos) {
    try {
      photoUrls[photo.id] = await getSignedUrl(
        STORAGE_BUCKETS.WORK_PHOTOS,
        photo.imagePath
      );
    } catch {
      photoUrls[photo.id] = "";
    }
  }

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

  const beforePhotos = invoice.workPhotos.filter(
    (p) => p.photoType === "BEFORE"
  );
  const afterPhotos = invoice.workPhotos.filter(
    (p) => p.photoType === "AFTER"
  );
  const duringPhotos = invoice.workPhotos.filter(
    (p) => p.photoType === "DURING"
  );

  const canSend = invoice.status === "DRAFT" || invoice.status === "SENT";
  const canApprove = invoice.status === "CUSTOMER_AUTHORIZED";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Invoice Detail</h1>
            <InvoiceStatusBadge status={invoice.status} />
          </div>
          <p className="mt-1 text-sm text-gray-500">
            Created{" "}
            {new Date(invoice.createdAt).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
            {invoice.createdBy && ` by ${invoice.createdBy.name}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {canSend && <SendTextButton invoiceId={invoice.id} />}
          {canApprove && (
            <Link
              href={`/dashboard/invoices/${invoice.id}/approve`}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700"
            >
              Review &amp; Approve
            </Link>
          )}
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Back
          </Link>
        </div>
      </div>

      {/* Customer & Vehicle Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Customer
          </h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Name</dt>
              <dd className="text-sm font-medium text-gray-900">
                {invoice.customerName}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Phone</dt>
              <dd className="text-sm font-medium text-gray-900">
                {invoice.customerPhone}
              </dd>
            </div>
            {invoice.customerEmail && (
              <div>
                <dt className="text-sm text-gray-500">Email</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {invoice.customerEmail}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {vehicleInfo && (
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
              Vehicle
            </h2>
            <dl className="space-y-2">
              {(vehicleInfo.year || vehicleInfo.make || vehicleInfo.model) && (
                <div>
                  <dt className="text-sm text-gray-500">Vehicle</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {[vehicleInfo.year, vehicleInfo.make, vehicleInfo.model]
                      .filter(Boolean)
                      .join(" ")}
                  </dd>
                </div>
              )}
              {vehicleInfo.vin && (
                <div>
                  <dt className="text-sm text-gray-500">VIN</dt>
                  <dd className="font-mono text-sm text-gray-900">
                    {vehicleInfo.vin}
                  </dd>
                </div>
              )}
              {vehicleInfo.mileage && (
                <div>
                  <dt className="text-sm text-gray-500">Mileage</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {vehicleInfo.mileage}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>

      {/* Description */}
      {invoice.description && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Work Description
          </h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {invoice.description}
          </p>
        </div>
      )}

      {/* Line Items */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200">
        <div className="p-6 pb-0">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
            Line Items
          </h2>
        </div>
        <div className="mt-3">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Description
                </th>
                <th className="px-6 py-2 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-6 py-2 text-right text-xs font-medium uppercase tracking-wider text-gray-500">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lineItems.map((item, i) => (
                <tr key={i}>
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {item.description}
                  </td>
                  <td className="px-6 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-700">
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                    {formatCents(item.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-gray-200 p-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">
                {formatCents(invoice.subtotalCents)}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-gray-600">Convenience Fee</span>
              <span className="text-gray-600">
                {formatCents(invoice.convenienceFeeCents)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base">
              <span className="font-semibold text-gray-900">Total</span>
              <span className="font-bold text-gray-900">
                {formatCents(invoice.totalCents)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Authorization Evidence */}
      {invoice.authorization && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Authorization Evidence
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Payer Name</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {invoice.authorization.payerName}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Is Customer</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {invoice.authorization.payerIsCustomer ? "Yes" : "No"}
                  {invoice.authorization.relationshipToCustomer &&
                    ` (${invoice.authorization.relationshipToCustomer})`}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">
                  Last Four (Card Entered)
                </dt>
                <dd className="font-mono text-sm font-medium text-gray-900">
                  **** {invoice.authorization.lastFourEntered}
                </dd>
              </div>
              {invoice.authorization.lastFourMatched !== null && (
                <div>
                  <dt className="text-sm text-gray-500">Last Four Matched</dt>
                  <dd className="text-sm font-medium">
                    {invoice.authorization.lastFourMatched ? (
                      <span className="text-green-700">Yes</span>
                    ) : (
                      <span className="text-red-700">No</span>
                    )}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm text-gray-500">Consent Timestamp</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {new Date(
                    invoice.authorization.consentTimestamp
                  ).toLocaleString()}
                </dd>
              </div>
              {invoice.authorization.ipAddress && (
                <div>
                  <dt className="text-sm text-gray-500">IP Address</dt>
                  <dd className="font-mono text-sm text-gray-900">
                    {invoice.authorization.ipAddress}
                  </dd>
                </div>
              )}
              {invoice.authorization.userAgent && (
                <div>
                  <dt className="text-sm text-gray-500">Device Info</dt>
                  <dd className="text-xs text-gray-600 break-all">
                    {invoice.authorization.userAgent}
                  </dd>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {dlFrontUrl && (
                <div>
                  <p className="mb-1 text-sm text-gray-500">
                    Driver&apos;s License (Front)
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dlFrontUrl}
                    alt="DL Front"
                    className="max-h-48 rounded-lg border border-gray-200 object-contain"
                  />
                </div>
              )}
              {dlBackUrl && (
                <div>
                  <p className="mb-1 text-sm text-gray-500">
                    Driver&apos;s License (Back)
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dlBackUrl}
                    alt="DL Back"
                    className="max-h-48 rounded-lg border border-gray-200 object-contain"
                  />
                </div>
              )}
              {signatureUrl && (
                <div>
                  <p className="mb-1 text-sm text-gray-500">Signature</p>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signatureUrl}
                    alt="Signature"
                    className="max-h-24 rounded-lg border border-gray-200 bg-white object-contain p-2"
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

      {/* Work Photos */}
      {(beforePhotos.length > 0 ||
        duringPhotos.length > 0 ||
        afterPhotos.length > 0) && (
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Work Photos
          </h2>

          {[
            { label: "Before", photos: beforePhotos },
            { label: "During", photos: duringPhotos },
            { label: "After", photos: afterPhotos },
          ]
            .filter((group) => group.photos.length > 0)
            .map((group) => (
              <div key={group.label} className="mb-4 last:mb-0">
                <h3 className="mb-2 text-sm font-medium text-gray-700">
                  {group.label} ({group.photos.length})
                </h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {group.photos.map((photo) => (
                    <div key={photo.id} className="group">
                      {photoUrls[photo.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photoUrls[photo.id]}
                          alt={photo.description || group.label}
                          className="aspect-square w-full rounded-lg border border-gray-200 object-cover"
                        />
                      ) : (
                        <div className="flex aspect-square w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                          <span className="text-xs text-gray-400">
                            No preview
                          </span>
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
            ))}
        </div>
      )}

      {/* Shop Approval */}
      {invoice.shopApproval && (
        <div
          className={`rounded-xl p-6 shadow-sm ring-1 ${
            invoice.shopApproval.decision === "APPROVED"
              ? "bg-green-50 ring-green-200"
              : "bg-red-50 ring-red-200"
          }`}
        >
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-gray-500">
            Shop Decision
          </h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  invoice.shopApproval.decision === "APPROVED"
                    ? "bg-green-100 text-green-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {invoice.shopApproval.decision}
              </span>
              <span className="text-sm text-gray-600">
                by {invoice.shopApproval.approvedBy.name} on{" "}
                {new Date(invoice.shopApproval.decidedAt).toLocaleString()}
              </span>
            </div>
            {invoice.shopApproval.rejectionReason && (
              <div>
                <p className="text-sm text-gray-500">Rejection Reason</p>
                <p className="text-sm font-medium text-red-700">
                  {invoice.shopApproval.rejectionReason}
                </p>
              </div>
            )}
            {invoice.shopApproval.notes && (
              <div>
                <p className="text-sm text-gray-500">Notes</p>
                <p className="text-sm text-gray-700">
                  {invoice.shopApproval.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-500">
          Timeline
        </h2>
        <div className="space-y-3">
          {[
            {
              label: "Created",
              date: invoice.createdAt,
              active: true,
            },
            {
              label: "Sent",
              date: invoice.sentAt,
              active: !!invoice.sentAt,
            },
            {
              label: "Viewed",
              date: invoice.viewedAt,
              active: !!invoice.viewedAt,
            },
            {
              label: "Customer Authorized",
              date: invoice.customerAuthorizedAt,
              active: !!invoice.customerAuthorizedAt,
            },
            {
              label: "Shop Approved",
              date: invoice.shopApprovedAt,
              active: !!invoice.shopApprovedAt,
            },
            {
              label: "Paid",
              date: invoice.paidAt,
              active: !!invoice.paidAt,
            },
          ].map((event) => (
            <div
              key={event.label}
              className={`flex items-center gap-3 ${
                event.active ? "text-gray-900" : "text-gray-300"
              }`}
            >
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  event.active ? "bg-blue-500" : "bg-gray-200"
                }`}
              />
              <span className="text-sm font-medium">{event.label}</span>
              {event.date && event.active && (
                <span className="text-xs text-gray-500">
                  {new Date(event.date).toLocaleString()}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
