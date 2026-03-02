"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

interface ShopData {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  convenienceFeeCents: number;
  stripeConnectAccountId: string | null;
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingStripe, setConnectingStripe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [convenienceFeeDollars, setConvenienceFeeDollars] = useState("");
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeAccountId, setStripeAccountId] = useState("");

  const fetchShop = useCallback(async () => {
    if (!session?.user?.shopId) return;

    try {
      const res = await fetch(`/api/shops/${session.user.shopId}`);
      if (!res.ok) throw new Error("Failed to load shop");

      const { shop } = (await res.json()) as { shop: ShopData };
      setName(shop.name || "");
      setAddress(shop.address || "");
      setPhone(shop.phone || "");
      setEmail(shop.email || "");
      setConvenienceFeeDollars(
        (shop.convenienceFeeCents / 100).toFixed(2)
      );
      setStripeConnected(!!shop.stripeConnectAccountId);
      setStripeAccountId(shop.stripeConnectAccountId || "");
    } catch {
      setError("Failed to load shop settings.");
    } finally {
      setLoading(false);
    }
  }, [session?.user?.shopId]);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  useEffect(() => {
    const stripeParam = searchParams.get("stripe");
    if (stripeParam === "success") {
      setSuccess("Stripe account connected successfully!");
      fetchShop();
    } else if (stripeParam === "refresh") {
      setError(
        "Stripe onboarding session expired. Please try again."
      );
    }
  }, [searchParams, fetchShop]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch(`/api/shops/${session?.user?.shopId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          phone,
          email,
          convenienceFeeCents: Math.round(
            parseFloat(convenienceFeeDollars) * 100
          ),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save settings");
      }

      setSuccess("Settings saved successfully!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save settings"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleConnectStripe() {
    setConnectingStripe(true);
    setError("");

    try {
      const res = await fetch("/api/shops/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopId: session?.user?.shopId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to start Stripe onboarding");
      }

      const { url } = await res.json();
      window.location.href = url;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to start Stripe onboarding"
      );
      setConnectingStripe(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-sm text-gray-500">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Shop Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your shop profile and payment settings.
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Shop Details Form */}
      <form onSubmit={handleSave} className="space-y-6">
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Shop Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Shop Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payment Settings */}
        <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Payment Settings
          </h2>
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Convenience Fee ($)
            </label>
            <p className="mt-0.5 text-xs text-gray-500">
              This fee is added to each invoice to cover text-to-pay processing.
            </p>
            <input
              type="number"
              step="0.01"
              min="0"
              value={convenienceFeeDollars}
              onChange={(e) => setConvenienceFeeDollars(e.target.value)}
              className="mt-1 block w-40 rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </form>

      {/* Stripe Connect */}
      <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-gray-200">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Stripe Connect
        </h2>

        {stripeConnected ? (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-5 w-5 text-green-600"
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
            </div>
            <div>
              <p className="text-sm font-medium text-green-700">
                Stripe account connected
              </p>
              <p className="text-xs text-gray-500">
                Account ID: {stripeAccountId}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-gray-600">
              Connect your Stripe account to receive payments from invoices.
              You will be redirected to Stripe to complete the onboarding
              process.
            </p>
            <button
              type="button"
              onClick={handleConnectStripe}
              disabled={connectingStripe}
              className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {connectingStripe ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Connecting...
                </>
              ) : (
                "Connect Stripe Account"
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
