"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Access is granted by the webhook a moment after payment, so refresh the
// server component until it appears (then the page redirects).
export function PurchasePoller() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 2500);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
