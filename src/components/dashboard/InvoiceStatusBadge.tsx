const statusConfig: Record<string, { label: string; classes: string }> = {
  DRAFT: {
    label: "Draft",
    classes: "bg-gray-100 text-gray-700",
  },
  SENT: {
    label: "Sent",
    classes: "bg-blue-100 text-blue-700",
  },
  VIEWED: {
    label: "Viewed",
    classes: "bg-yellow-100 text-yellow-700",
  },
  CUSTOMER_AUTHORIZED: {
    label: "Customer Authorized",
    classes: "bg-orange-100 text-orange-700",
  },
  SHOP_APPROVED: {
    label: "Shop Approved",
    classes: "bg-teal-100 text-teal-700",
  },
  PAID: {
    label: "Paid",
    classes: "bg-green-100 text-green-700",
  },
  REJECTED: {
    label: "Rejected",
    classes: "bg-red-100 text-red-700",
  },
  EXPIRED: {
    label: "Expired",
    classes: "bg-gray-100 text-gray-500",
  },
  DISPUTED: {
    label: "Disputed",
    classes: "bg-red-100 text-red-700",
  },
  REFUNDED: {
    label: "Refunded",
    classes: "bg-purple-100 text-purple-700",
  },
};

export default function InvoiceStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || {
    label: status,
    classes: "bg-gray-100 text-gray-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.classes}`}
    >
      {config.label}
    </span>
  );
}
