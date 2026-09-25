import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

type CheckoutInput = {
  variantId: string;
  email: string;
  userId: string;
  courseId: string;
  redirectUrl: string;
};

// Creates a Lemon Squeezy checkout via the API and returns its URL. user_id and
// course_id ride along as custom data and come back on the webhook. Returns null
// if Lemon Squeezy isn't configured yet.
export async function createCheckoutUrl(input: CheckoutInput): Promise<string | null> {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  if (!apiKey || !storeId || !input.variantId) return null;

  const res = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: input.email,
            custom: { user_id: input.userId, course_id: input.courseId },
          },
          product_options: { redirect_url: input.redirectUrl },
        },
        relationships: {
          store: { data: { type: "stores", id: String(storeId) } },
          variant: { data: { type: "variants", id: String(input.variantId) } },
        },
      },
    }),
  });

  if (!res.ok) {
    console.error("lemonsqueezy: checkout create failed", res.status, await res.text());
    return null;
  }
  const json = await res.json();
  return json?.data?.attributes?.url ?? null;
}

// Verifies the webhook signature (HMAC-SHA256 hex of the raw body).
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
