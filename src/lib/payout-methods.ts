// Payout methods and the fields each one needs. Shared by the settings form,
// its validation, and the admin payouts view.
export const PAYOUT_METHODS = [
  {
    value: "juice",
    label: "MCB Juice",
    fields: [{ key: "phone", label: "Juice phone number", placeholder: "+230 5xxx xxxx" }],
  },
  {
    value: "bank",
    label: "Bank transfer",
    fields: [
      { key: "account_name", label: "Account holder name" },
      { key: "bank_name", label: "Bank name" },
      { key: "account_number", label: "Account number / IBAN" },
    ],
  },
  {
    value: "wise",
    label: "Wise",
    fields: [{ key: "email", label: "Wise email" }],
  },
  {
    value: "paypal",
    label: "PayPal",
    fields: [{ key: "email", label: "PayPal email" }],
  },
] as const;

export type PayoutMethod = (typeof PAYOUT_METHODS)[number]["value"];

export function payoutMethod(value: string) {
  return PAYOUT_METHODS.find((m) => m.value === value);
}

export function payoutMethodLabel(value: string | null | undefined) {
  return PAYOUT_METHODS.find((m) => m.value === value)?.label ?? value ?? "—";
}

// Human-readable one-line summary of stored details for the admin view.
export function summarizePayoutDetails(method: string, details: Record<string, unknown>): string {
  const config = payoutMethod(method);
  if (!config) return "";
  return config.fields
    .map((f) => details[f.key])
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .join(" · ");
}
