import twilio from "twilio";

let _client: ReturnType<typeof twilio> | null = null;

function getClient() {
  if (_client) return _client;
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.warn("Twilio credentials not set — SMS will not be sent");
    return null;
  }
  _client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return _client;
}

/**
 * Send an SMS payment link to a customer
 */
export async function sendPaymentLink({
  to,
  shopName,
  invoiceId,
  totalCents,
}: {
  to: string;
  shopName: string;
  invoiceId: string;
  totalCents: number;
}) {
  const client = getClient();
  if (!client) {
    console.warn("Twilio not configured — skipping SMS");
    return null;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const total = (totalCents / 100).toFixed(2);
  const link = `${appUrl}/pay/${invoiceId}`;

  return client.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: `${shopName}: Your invoice for $${total} is ready. Pay securely here: ${link}`,
  });
}

/**
 * Send a payment confirmation text
 */
export async function sendConfirmation({
  to,
  shopName,
  totalCents,
}: {
  to: string;
  shopName: string;
  totalCents: number;
}) {
  const client = getClient();
  if (!client) {
    console.warn("Twilio not configured — skipping SMS");
    return null;
  }

  const total = (totalCents / 100).toFixed(2);

  return client.messages.create({
    to,
    from: process.env.TWILIO_PHONE_NUMBER!,
    body: `${shopName}: Your payment of $${total} has been confirmed. Thank you!`,
  });
}
