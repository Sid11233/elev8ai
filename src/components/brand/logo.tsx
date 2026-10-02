import Link from "next/link";

import { cn } from "@/lib/utils";

import { BrandSeal } from "./seal";

// Wordmark + seal lockup. Clear space around the seal ~ the width of its wax
// droplet detail (the px-* / gap here). Always lowercase, three n's.
export function Logo({
  href = "/",
  className,
  sealSize = 30,
  showWordmark = true,
}: {
  href?: string;
  className?: string;
  sealSize?: number;
  showWordmark?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-label="lockedinnn"
      className={cn("inline-flex items-center gap-2", className)}
    >
      <BrandSeal size={sealSize} />
      {showWordmark && (
        <span className="text-lg font-bold tracking-tight lowercase">lockedinnn</span>
      )}
    </Link>
  );
}
