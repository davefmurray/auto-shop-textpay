"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ApprovalActionsProps {
  invoiceId: string;
}

export default function ApprovalActions({ invoiceId }: ApprovalActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");

  // Reject modal state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // After photos upload
  const [afterPhotos, setAfterPhotos] = useState<File[]>([]);
  const [afterDescriptions, setAfterDescriptions] = useState<string[]>([]);

  function handleAfterPhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    setAfterPhotos([...afterPhotos, ...newFiles]);
    setAfterDescriptions([
      ...afterDescriptions,
      ...newFiles.map(() => ""),
    ]);
    e.target.value = "";
  }

  function removeAfterPhoto(index: number) {
    setAfterPhotos(afterPhotos.filter((_, i) => i !== index));
    setAfterDescriptions(afterDescriptions.filter((_, i) => i !== index));
  }

  function updateAfterDescription(index: number, value: string) {
    const updated = [...afterDescriptions];
    updated[index] = value;
    setAfterDescriptions(updated);
  }

  async function uploadAfterPhotos() {
    if (afterPhotos.length === 0) return;

    const formData = new FormData();
    formData.append("photoType", "AFTER");
    formData.append("descriptions", JSON.stringify(afterDescriptions));
    afterPhotos.forEach((file) => formData.append("photos", file));

    const res = await fetch(`/api/invoices/${invoiceId}/photos`, {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to upload after photos");
    }
  }

  async function handleApprove() {
    setLoading(true);
    setError("");

    try {
      // Upload after photos first
      await uploadAfterPhotos();

      // Approve the invoice
      const res = await fetch(`/api/invoices/${invoiceId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes || undefined }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to approve invoice");
      }

      router.push(`/dashboard/invoices/${invoiceId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to approve invoice"
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!rejectionReason.trim()) {
      setError("Rejection reason is required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/invoices/${invoiceId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rejectionReason,
          notes: notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reject invoice");
      }

      router.push(`/dashboard/invoices/${invoiceId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reject invoice"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* After Photos Upload */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">
          After Photos
        </h2>
        <p className="mb-3 text-sm text-gray-600">
          Upload photos of the completed work before approving.
        </p>

        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z"
            />
          </svg>
          Choose After Photos
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleAfterPhotoAdd}
            className="hidden"
          />
        </label>

        {afterPhotos.length > 0 && (
          <div className="mt-4 space-y-3">
            {afterPhotos.map((file, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg bg-gray-50 p-3"
              >
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-200">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={URL.createObjectURL(file)}
                    alt="Preview"
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {file.name}
                  </p>
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={afterDescriptions[i]}
                    onChange={(e) =>
                      updateAfterDescription(i, e.target.value)
                    }
                    className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeAfterPhoto(i)}
                  className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18 18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-3 text-lg font-semibold text-gray-900">Notes</h2>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Add any notes about this approval..."
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="flex-1 rounded-lg bg-green-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Processing..." : "Approve & Capture Payment"}
        </button>
        <button
          onClick={() => setShowRejectModal(true)}
          disabled={loading}
          className="flex-1 rounded-lg bg-red-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Reject
        </button>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Reject Invoice
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              This will cancel the payment hold and reject the invoice. Please
              provide a reason.
            </p>

            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={3}
              placeholder="Reason for rejection..."
              className="mt-4 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              autoFocus
            />

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason("");
                }}
                disabled={loading}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  handleReject();
                }}
                disabled={loading || !rejectionReason.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
