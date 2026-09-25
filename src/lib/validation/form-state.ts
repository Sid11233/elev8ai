import { z } from "zod";

// State returned by form server actions and read by useActionState.
export type FormState<F extends string = string> = {
  message?: string;
  fieldErrors?: Partial<Record<F, string>>;
  // Submitted text values, so fields keep what the user typed after an error.
  values?: Record<string, string>;
};

// First error message per field.
export function fieldErrorsOf<F extends string>(error: z.ZodError): Partial<Record<F, string>> {
  const out: Partial<Record<F, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "") as F;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

// Text values of the given fields from FormData ("" when missing).
export function textValues<K extends string>(formData: FormData, keys: readonly K[]) {
  return Object.fromEntries(
    keys.map((k) => [k, typeof formData.get(k) === "string" ? String(formData.get(k)) : ""]),
  ) as Record<K, string>;
}
