"use client";
import { useState, useCallback } from "react";
import { SignaturePad } from "@/components/pay/SignaturePad";
import { StripePaymentForm } from "@/components/pay/StripePaymentForm";
import { getDisclaimerTexts } from "@/lib/utils";

interface InvoiceData {
  id: string;
  customerName: string;
  vehicleInfo: Record<string, string> | null;
  lineItems: Array<{ description: string; amountCents: number; type: string }>;
  subtotalCents: number;
  convenienceFeeCents: number;
  totalCents: number;
  shopName: string;
  shopId: string;
}

interface DisclaimerRecord {
  text: string;
  acceptedAt: string | null;
}

const STEP_LABELS = [
  "Review",
  "Payer",
  "Verify",
  "Authorize",
  "Payment",
  "Done",
];

const RELATIONSHIPS = [
  { value: "spouse", label: "Spouse / Partner" },
  { value: "parent", label: "Parent" },
  { value: "friend", label: "Friend" },
  { value: "employer", label: "Employer" },
  { value: "other", label: "Other" },
];

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function StepIndicator({ currentStep, totalSteps }: { currentStep: number; totalSteps: number }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-6">
      {Array.from({ length: totalSteps }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === currentStep;
        const isCompleted = stepNum < currentStep;
        return (
          <div key={stepNum} className="flex items-center">
            <div
              className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                ${isActive ? "bg-blue-600 text-white" : ""}
                ${isCompleted ? "bg-blue-100 text-blue-600" : ""}
                ${!isActive && !isCompleted ? "bg-gray-200 text-gray-500" : ""}
              `}
            >
              {isCompleted ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                stepNum
              )}
            </div>
            {i < totalSteps - 1 && (
              <div
                className={`w-6 h-0.5 mx-0.5 ${
                  stepNum < currentStep ? "bg-blue-300" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PaymentFlow({ invoice }: { invoice: InvoiceData }) {
  // Step state: 1-6
  const [step, setStep] = useState(1);

  // Step 2: Payer identification
  const [payerIsCustomer, setPayerIsCustomer] = useState(true);
  const [payerName, setPayerName] = useState(invoice.customerName);
  const [relationship, setRelationship] = useState("");

  // Step 3: Identity verification
  const [dlImage, setDlImage] = useState<File | null>(null);
  const [dlPreview, setDlPreview] = useState<string | null>(null);
  const [lastFour, setLastFour] = useState("");

  // Step 4: Disclaimers and signature
  const [disclaimersAccepted, setDisclaimersAccepted] = useState<DisclaimerRecord[]>([]);
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [disclaimersInitialized, setDisclaimersInitialized] = useState(false);

  // Step 5: Stripe payment
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [authorizeError, setAuthorizeError] = useState<string | null>(null);
  const [authorizing, setAuthorizing] = useState(false);

  // Initialize disclaimers when we have all the info (entering step 4)
  const initializeDisclaimers = useCallback(() => {
    if (disclaimersInitialized) return;
    const texts = getDisclaimerTexts({
      shopName: invoice.shopName,
      totalCents: invoice.totalCents,
      lastFour,
      payerName,
      customerName: invoice.customerName,
      convenienceFeeCents: invoice.convenienceFeeCents,
    });
    setDisclaimersAccepted(
      texts.map((text) => ({ text, acceptedAt: null }))
    );
    setDisclaimersInitialized(true);
  }, [disclaimersInitialized, invoice, lastFour, payerName]);

  const handleDlUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDlImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setDlPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const toggleDisclaimer = (index: number) => {
    setDisclaimersAccepted((prev) =>
      prev.map((d, i) => {
        if (i !== index) return d;
        return {
          ...d,
          acceptedAt: d.acceptedAt ? null : new Date().toISOString(),
        };
      })
    );
  };

  const allDisclaimersAccepted = disclaimersAccepted.length > 0 && disclaimersAccepted.every((d) => d.acceptedAt !== null);

  const handleAuthorize = async () => {
    if (!signatureData || !allDisclaimersAccepted) return;

    setAuthorizing(true);
    setAuthorizeError(null);

    try {
      const formData = new FormData();
      formData.append("payerName", payerName);
      formData.append("payerIsCustomer", String(payerIsCustomer));
      formData.append("relationship", relationship);
      formData.append("lastFourEntered", lastFour);
      formData.append("authorizationText", disclaimersAccepted[0].text);
      formData.append("disclaimersAccepted", JSON.stringify(disclaimersAccepted));
      formData.append("signatureData", signatureData);
      if (dlImage) formData.append("dlImage", dlImage);

      const res = await fetch(`/api/invoices/${invoice.id}/authorize`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: "Authorization failed" }));
        throw new Error(errorData.error || "Authorization failed");
      }

      const data = await res.json();
      setClientSecret(data.clientSecret);
      setStep(5);
    } catch (err) {
      setAuthorizeError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setAuthorizing(false);
    }
  };

  const goToStep = (nextStep: number) => {
    if (nextStep === 4) {
      initializeDisclaimers();
    }
    setStep(nextStep);
  };

  // -- Step 1: Invoice Review --
  const renderStep1 = () => (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-1">Invoice Review</h2>
      <p className="text-sm text-gray-500 mb-4">
        From <span className="font-medium text-gray-700">{invoice.shopName}</span>
        {" "}&middot; For <span className="font-medium text-gray-700">{invoice.customerName}</span>
      </p>

      {invoice.vehicleInfo && Object.keys(invoice.vehicleInfo).length > 0 && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Vehicle</p>
          <p className="text-sm text-gray-800">
            {[
              invoice.vehicleInfo.year,
              invoice.vehicleInfo.make,
              invoice.vehicleInfo.model,
            ]
              .filter(Boolean)
              .join(" ")}
            {invoice.vehicleInfo.vin && (
              <span className="text-gray-500 ml-2">VIN: {invoice.vehicleInfo.vin}</span>
            )}
          </p>
        </div>
      )}

      <div className="space-y-2 mb-4">
        {invoice.lineItems.map((item, i) => (
          <div key={i} className="flex justify-between items-start py-2 border-b border-gray-100 last:border-b-0">
            <div className="flex-1 pr-3">
              <p className="text-sm text-gray-800">{item.description}</p>
              <p className="text-xs text-gray-500 capitalize">{item.type.toLowerCase().replace("_", " ")}</p>
            </div>
            <p className="text-sm font-medium text-gray-900 whitespace-nowrap">
              {formatCents(item.amountCents)}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-3 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="text-gray-900">{formatCents(invoice.subtotalCents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Convenience fee</span>
          <span className="text-gray-900">{formatCents(invoice.convenienceFeeCents)}</span>
        </div>
        <div className="flex justify-between text-base font-bold pt-1.5 border-t border-gray-200">
          <span className="text-gray-900">Total</span>
          <span className="text-gray-900">{formatCents(invoice.totalCents)}</span>
        </div>
      </div>

      <button
        onClick={() => goToStep(2)}
        className="mt-6 w-full bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold text-lg hover:bg-blue-700 transition-colors"
      >
        Continue to Payment
      </button>
    </div>
  );

  // -- Step 2: Payer Identification --
  const renderStep2 = () => {
    const canContinue = payerIsCustomer || (payerName.trim().length > 0 && relationship.length > 0);

    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Who is paying?</h2>
        <p className="text-sm text-gray-500 mb-6">
          Confirm who is authorizing this payment.
        </p>

        <div className="space-y-3">
          <label
            className={`flex items-center p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              payerIsCustomer ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="payerType"
              checked={payerIsCustomer}
              onChange={() => {
                setPayerIsCustomer(true);
                setPayerName(invoice.customerName);
                setRelationship("");
              }}
              className="w-4 h-4 text-blue-600"
            />
            <span className="ml-3 text-sm font-medium text-gray-900">
              I am {invoice.customerName}
            </span>
          </label>

          <label
            className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-colors ${
              !payerIsCustomer ? "border-blue-600 bg-blue-50" : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="payerType"
              checked={!payerIsCustomer}
              onChange={() => {
                setPayerIsCustomer(false);
                setPayerName("");
              }}
              className="w-4 h-4 text-blue-600 mt-0.5"
            />
            <span className="ml-3 text-sm font-medium text-gray-900">
              I&apos;m paying on behalf of {invoice.customerName}
            </span>
          </label>
        </div>

        {!payerIsCustomer && (
          <div className="mt-4 space-y-4 animate-in slide-in-from-top-2">
            <div>
              <label htmlFor="payerName" className="block text-sm font-medium text-gray-700 mb-1">
                Your full name
              </label>
              <input
                id="payerName"
                type="text"
                value={payerName}
                onChange={(e) => setPayerName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <label htmlFor="relationship" className="block text-sm font-medium text-gray-700 mb-1">
                Relationship to {invoice.customerName}
              </label>
              <select
                id="relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="">Select relationship...</option>
                {RELATIONSHIPS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => goToStep(1)}
            className="px-6 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => goToStep(3)}
            disabled={!canContinue}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  };

  // -- Step 3: Identity Verification --
  const renderStep3 = () => {
    const canContinue = lastFour.length === 4;

    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Identity Verification</h2>
        <p className="text-sm text-gray-500 mb-6">
          For fraud protection, please provide the following.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Driver&apos;s license photo
            </label>
            {dlPreview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={dlPreview}
                  alt="Driver's license preview"
                  className="w-full h-40 object-cover rounded-lg border border-gray-200"
                />
                <button
                  type="button"
                  onClick={() => {
                    setDlImage(null);
                    setDlPreview(null);
                  }}
                  className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-gray-700 rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold shadow hover:bg-white"
                >
                  X
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 hover:bg-gray-50 transition-colors">
                <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                </svg>
                <span className="text-sm text-gray-500">Tap to take photo or upload</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleDlUpload}
                  className="hidden"
                />
              </label>
            )}
            <p className="text-xs text-gray-400 mt-1">Optional but recommended for fraud protection</p>
          </div>

          <div>
            <label htmlFor="lastFour" className="block text-sm font-medium text-gray-700 mb-1">
              Last 4 digits of card you will use
            </label>
            <input
              id="lastFour"
              type="text"
              inputMode="numeric"
              maxLength={4}
              value={lastFour}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                setLastFour(val);
              }}
              placeholder="1234"
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none tracking-widest text-center text-lg"
            />
            <p className="text-xs text-gray-400 mt-1">
              This will be matched against the card used for payment.
            </p>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={() => goToStep(2)}
            className="px-6 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Back
          </button>
          <button
            onClick={() => goToStep(4)}
            disabled={!canContinue}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    );
  };

  // -- Step 4: Authorization & Disclaimers --
  const renderStep4 = () => {
    const canAuthorize = allDisclaimersAccepted && signatureData !== null;

    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Authorization</h2>
        <p className="text-sm text-gray-500 mb-5">
          Please read and acknowledge each statement, then sign below.
        </p>

        <div className="space-y-3 mb-6">
          {disclaimersAccepted.map((d, i) => (
            <label
              key={i}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                d.acceptedAt
                  ? "border-green-200 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={d.acceptedAt !== null}
                onChange={() => toggleDisclaimer(i)}
                className="w-4 h-4 mt-0.5 text-blue-600 rounded shrink-0"
              />
              <span className="text-sm text-gray-700 leading-snug">{d.text}</span>
            </label>
          ))}
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Signature
          </label>
          <SignaturePad onSignatureChange={setSignatureData} />
        </div>

        {authorizeError && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            {authorizeError}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => goToStep(3)}
            disabled={authorizing}
            className="px-6 py-3 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Back
          </button>
          <button
            onClick={handleAuthorize}
            disabled={!canAuthorize || authorizing}
            className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-xl font-semibold text-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {authorizing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Submitting...
              </span>
            ) : (
              "Continue to Payment"
            )}
          </button>
        </div>
      </div>
    );
  };

  // -- Step 5: Stripe Payment --
  const renderStep5 = () => {
    if (!clientSecret) {
      return (
        <div className="text-center py-8">
          <svg className="animate-spin w-8 h-8 mx-auto text-blue-600 mb-3" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-gray-600">Preparing payment...</p>
        </div>
      );
    }

    return (
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Payment</h2>
        <p className="text-sm text-gray-500 mb-6">
          Enter your card details. Your card will be authorized for{" "}
          <span className="font-semibold text-gray-700">{formatCents(invoice.totalCents)}</span> but
          will not be charged until {invoice.shopName} confirms your service is complete.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm text-blue-800">
              This is an authorization hold, not a charge. You will only be charged after the shop
              confirms the work is complete.
            </p>
          </div>
        </div>

        <StripePaymentForm
          clientSecret={clientSecret}
          totalCents={invoice.totalCents}
          onSuccess={() => goToStep(6)}
        />
      </div>
    );
  };

  // -- Step 6: Confirmation --
  const renderStep6 = () => (
    <div className="text-center py-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Authorization Held</h2>
      <p className="text-gray-600 mb-4">
        Your card has been authorized for{" "}
        <span className="font-semibold">{formatCents(invoice.totalCents)}</span>.
      </p>
      <div className="bg-gray-50 rounded-xl p-4 text-left space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Shop</span>
          <span className="text-gray-900 font-medium">{invoice.shopName}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Amount authorized</span>
          <span className="text-gray-900 font-medium">{formatCents(invoice.totalCents)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Status</span>
          <span className="text-amber-600 font-medium">Pending shop confirmation</span>
        </div>
      </div>
      <p className="text-sm text-gray-500">
        You will NOT be charged until {invoice.shopName} confirms your service is complete.
        You&apos;ll receive a text when your payment is finalized.
      </p>
    </div>
  );

  const renderCurrentStep = () => {
    switch (step) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      case 5:
        return renderStep5();
      case 6:
        return renderStep6();
      default:
        return renderStep1();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 pt-8">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-4">
          <h1 className="text-sm font-semibold text-blue-600 tracking-wider uppercase">
            {invoice.shopName}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">Secure Payment</p>
        </div>

        {/* Step indicator */}
        {step < 6 && (
          <StepIndicator currentStep={step} totalSteps={5} />
        )}

        {/* Step label */}
        {step < 6 && (
          <p className="text-center text-xs text-gray-500 -mt-4 mb-4">
            Step {step} of 5: {STEP_LABELS[step - 1]}
          </p>
        )}

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          {renderCurrentStep()}
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Powered by Auto Shop TextPay
        </p>
      </div>
    </div>
  );
}
