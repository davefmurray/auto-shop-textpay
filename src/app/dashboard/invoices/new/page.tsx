"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface LineItem {
  id: string;
  description: string;
  amountDollars: string;
  type: "labor" | "parts" | "diagnostic" | "other";
}

interface PhotoFile {
  id: string;
  file: File;
  description: string;
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Customer info
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Vehicle info
  const [vehicleYear, setVehicleYear] = useState("");
  const [vehicleMake, setVehicleMake] = useState("");
  const [vehicleModel, setVehicleModel] = useState("");
  const [vehicleVin, setVehicleVin] = useState("");
  const [vehicleMileage, setVehicleMileage] = useState("");

  // Description
  const [description, setDescription] = useState("");

  // Line items
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: generateId(), description: "", amountDollars: "", type: "labor" },
  ]);

  // Photos
  const [photos, setPhotos] = useState<PhotoFile[]>([]);

  function addLineItem() {
    setLineItems([
      ...lineItems,
      { id: generateId(), description: "", amountDollars: "", type: "labor" },
    ]);
  }

  function removeLineItem(id: string) {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((item) => item.id !== id));
  }

  function updateLineItem(id: string, field: keyof LineItem, value: string) {
    setLineItems(
      lineItems.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  }

  function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    const newPhotos: PhotoFile[] = Array.from(e.target.files).map((file) => ({
      id: generateId(),
      file,
      description: "",
    }));
    setPhotos([...photos, ...newPhotos]);
    e.target.value = "";
  }

  function removePhoto(id: string) {
    setPhotos(photos.filter((p) => p.id !== id));
  }

  function updatePhotoDescription(id: string, description: string) {
    setPhotos(
      photos.map((p) => (p.id === id ? { ...p, description } : p))
    );
  }

  const subtotalCents = lineItems.reduce((sum, item) => {
    const dollars = parseFloat(item.amountDollars) || 0;
    return sum + Math.round(dollars * 100);
  }, 0);

  // Convenience fee is set on the server, but we show an estimate
  const convenienceFeeCents = 500; // $5.00 default shown as estimate
  const totalCents = subtotalCents + convenienceFeeCents;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Validate line items
      const validLineItems = lineItems.filter(
        (item) => item.description && parseFloat(item.amountDollars) > 0
      );

      if (validLineItems.length === 0) {
        setError("Add at least one line item with a description and amount.");
        setLoading(false);
        return;
      }

      const vehicleInfo =
        vehicleYear || vehicleMake || vehicleModel
          ? {
              year: vehicleYear,
              make: vehicleMake,
              model: vehicleModel,
              vin: vehicleVin || undefined,
              mileage: vehicleMileage || undefined,
            }
          : undefined;

      const payload = {
        customerName,
        customerPhone,
        customerEmail: customerEmail || undefined,
        vehicleInfo,
        description: description || undefined,
        lineItems: validLineItems.map((item) => ({
          description: item.description,
          amountCents: Math.round(parseFloat(item.amountDollars) * 100),
          type: item.type,
        })),
      };

      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create invoice");
      }

      const { invoice } = await res.json();

      // Upload before photos if any
      if (photos.length > 0) {
        const formData = new FormData();
        formData.append("photoType", "BEFORE");
        formData.append(
          "descriptions",
          JSON.stringify(photos.map((p) => p.description))
        );
        photos.forEach((p) => formData.append("photos", p.file));

        await fetch(`/api/invoices/${invoice.id}/photos`, {
          method: "POST",
          body: formData,
        });
      }

      router.push(`/dashboard/invoices/${invoice.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create invoice"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
        <p className="mt-1 text-sm text-gray-600">
          Fill in the details below to create a new invoice.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Information */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Customer Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Name *
              </label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Phone *
              </label>
              <input
                type="tel"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+15551234567"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Email (optional)
              </label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Vehicle Information */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Vehicle Information
          </h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Year
              </label>
              <input
                type="text"
                value={vehicleYear}
                onChange={(e) => setVehicleYear(e.target.value)}
                placeholder="2024"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Make
              </label>
              <input
                type="text"
                value={vehicleMake}
                onChange={(e) => setVehicleMake(e.target.value)}
                placeholder="Toyota"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Model
              </label>
              <input
                type="text"
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                placeholder="Camry"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                VIN (optional)
              </label>
              <input
                type="text"
                value={vehicleVin}
                onChange={(e) => setVehicleVin(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Mileage (optional)
              </label>
              <input
                type="text"
                value={vehicleMileage}
                onChange={(e) => setVehicleMileage(e.target.value)}
                placeholder="45,000"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Work Description
          </h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Describe the work to be performed..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        {/* Line Items */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Line Items
          </h2>
          <div className="space-y-3">
            {lineItems.map((item, index) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-lg bg-gray-50 p-3"
              >
                <div className="min-w-0 flex-1 grid gap-3 sm:grid-cols-12">
                  <div className="sm:col-span-5">
                    <label className="block text-xs font-medium text-gray-500">
                      Description
                    </label>
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) =>
                        updateLineItem(item.id, "description", e.target.value)
                      }
                      placeholder="Oil change, brake pads, etc."
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-500">
                      Amount ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.amountDollars}
                      onChange={(e) =>
                        updateLineItem(
                          item.id,
                          "amountDollars",
                          e.target.value
                        )
                      }
                      placeholder="0.00"
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-xs font-medium text-gray-500">
                      Type
                    </label>
                    <select
                      value={item.type}
                      onChange={(e) =>
                        updateLineItem(item.id, "type", e.target.value)
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="labor">Labor</option>
                      <option value="parts">Parts</option>
                      <option value="diagnostic">Diagnostic</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="flex items-end sm:col-span-1">
                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(item.id)}
                        className="mb-0.5 rounded-md p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        title={`Remove line item ${index + 1}`}
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
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addLineItem}
            className="mt-3 inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
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
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add Line Item
          </button>

          {/* Totals */}
          <div className="mt-4 border-t border-gray-200 pt-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">
                ${(subtotalCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-gray-600">
                Convenience Fee (estimate)
              </span>
              <span className="text-gray-600">
                ${(convenienceFeeCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base">
              <span className="font-semibold text-gray-900">
                Estimated Total
              </span>
              <span className="font-bold text-gray-900">
                ${(totalCents / 100).toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Before Photos */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Before Photos
          </h2>
          <p className="mb-3 text-sm text-gray-600">
            Upload photos of the vehicle before work begins.
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
            Choose Photos
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handlePhotoAdd}
              className="hidden"
            />
          </label>

          {photos.length > 0 && (
            <div className="mt-4 space-y-3">
              {photos.map((photo) => (
                <div
                  key={photo.id}
                  className="flex items-start gap-3 rounded-lg bg-gray-50 p-3"
                >
                  <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-md bg-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(photo.file)}
                      alt="Preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {photo.file.name}
                    </p>
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={photo.description}
                      onChange={(e) =>
                        updatePhotoDescription(photo.id, e.target.value)
                      }
                      className="mt-1 block w-full rounded-md border border-gray-300 px-2.5 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removePhoto(photo.id)}
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

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Creating Invoice..." : "Create Invoice"}
          </button>
        </div>
      </form>
    </div>
  );
}
