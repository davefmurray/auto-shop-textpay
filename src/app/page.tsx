import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-5xl mx-auto">
        <span className="text-lg font-semibold tracking-tight">TextPay</span>
        <Link
          href="/login"
          className="text-sm text-zinc-400 hover:text-white transition-colors"
        >
          Shop Login
        </Link>
      </nav>

      {/* Hero */}
      <section className="px-6 pt-24 pb-20 max-w-3xl mx-auto text-center">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
          Text-to-Pay for
          <br />
          Auto Repair Shops
        </h1>
        <p className="mt-6 text-lg text-zinc-400 max-w-xl mx-auto leading-relaxed">
          Send invoices via text. Get paid faster. Every transaction is backed by
          identity verification and chargeback protection built for card-not-present
          payments.
        </p>
        <Link
          href="/login"
          className="inline-block mt-10 px-8 py-3 bg-white text-zinc-950 font-medium rounded-lg hover:bg-zinc-200 transition-colors"
        >
          Shop Login
        </Link>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-14">
            How It Works
          </h2>
          <div className="grid sm:grid-cols-3 gap-10 text-center">
            <div>
              <div className="text-3xl font-bold text-zinc-600 mb-3">1</div>
              <h3 className="font-semibold mb-2">Create Invoice</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Enter the repair details, line items, and customer phone number
                from your shop dashboard.
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-zinc-600 mb-3">2</div>
              <h3 className="font-semibold mb-2">Customer Pays via Text</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Customer receives a payment link by SMS, verifies their identity,
                and authorizes the charge.
              </p>
            </div>
            <div>
              <div className="text-3xl font-bold text-zinc-600 mb-3">3</div>
              <h3 className="font-semibold mb-2">Get Paid with Protection</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Review the authorization, upload work photos, and capture
                payment — fully protected against disputes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="px-6 py-20 border-t border-zinc-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-semibold text-center mb-14">
            Built for Repair Shops
          </h2>
          <div className="grid sm:grid-cols-2 gap-8">
            <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
              <h3 className="font-semibold mb-2">Chargeback Guarantee</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Every transaction collects the evidence needed to win disputes —
                we guarantee it or cover the loss.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
              <h3 className="font-semibold mb-2">Identity Verification</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Customers upload a driver&apos;s license photo and sign
                electronically before payment is authorized.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
              <h3 className="font-semibold mb-2">Before &amp; After Photos</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Document every job with timestamped photos that become
                dispute evidence automatically.
              </p>
            </div>
            <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
              <h3 className="font-semibold mb-2">Two-Step Capture</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">
                Funds are held until you approve — verify the work is done and
                the customer is real before you get paid.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-10 border-t border-zinc-800 text-center text-sm text-zinc-500">
        &copy; {new Date().getFullYear()} TextPay
      </footer>
    </div>
  );
}
