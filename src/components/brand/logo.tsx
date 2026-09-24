import Link from "next/link";

import { cn } from "@/lib/utils";

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("text-lg font-bold tracking-tight", className)}>
      Elev8<span className="text-primary">ai</span>
    </Link>
  );
}
