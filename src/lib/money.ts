// Money is integer cents everywhere. These helpers convert at the edges only.

// "5", "5.5", "5.50", "$1,250.00" -> cents. Returns null if it isn't a valid amount.
// Parses the string directly so no floating-point maths ever touches money.
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.trim().replace(/[$,\s]/g, "");
  const match = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(cleaned);
  if (!match) return null;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  return whole * 100 + fraction;
}

// 500 -> "$5", 550 -> "$5.50", 125000 -> "$1,250"
export function formatCents(cents: number): string {
  const whole = Math.trunc(cents / 100);
  const fraction = Math.abs(cents % 100);
  const wholeText = whole.toLocaleString("en-US");
  return fraction ? `$${wholeText}.${String(fraction).padStart(2, "0")}` : `$${wholeText}`;
}

// For pre-filling an input: 550 -> "5.50", 500 -> "5"
export function centsToInput(cents: number): string {
  const fraction = cents % 100;
  return fraction
    ? `${Math.trunc(cents / 100)}.${String(fraction).padStart(2, "0")}`
    : String(cents / 100);
}

type PayFields = {
  pay_cents: number;
  pay_type: string;
  unit_label: string | null;
  max_units: number | null;
};

function plural(label: string, count: number) {
  return count === 1 || label.endsWith("s") ? label : `${label}s`;
}

// "$25" for fixed jobs, "$5 per clip" for per-unit jobs.
export function formatPay(job: PayFields): string {
  if (job.pay_type === "per_unit" && job.unit_label) {
    return `${formatCents(job.pay_cents)} per ${job.unit_label}`;
  }
  return formatCents(job.pay_cents);
}

// "max 20 clips · up to $100" for per-unit jobs, null for fixed.
export function formatPayCap(job: PayFields): string | null {
  if (job.pay_type !== "per_unit" || !job.unit_label || !job.max_units) return null;
  return `max ${job.max_units} ${plural(job.unit_label, job.max_units)} · up to ${formatCents(
    job.pay_cents * job.max_units,
  )}`;
}

// Most a single worker can earn from a job, used for the "minimum pay" filter.
export function maxEarningsCents(job: PayFields): number {
  return job.pay_type === "per_unit" && job.max_units
    ? job.pay_cents * job.max_units
    : job.pay_cents;
}
