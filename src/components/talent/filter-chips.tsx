import Link from "next/link";

import { cn } from "@/lib/utils";

// A row of link chips; one option is active. Scrolls sideways on small screens.
export function FilterChips({
  label,
  options,
}: {
  label: string;
  options: { label: string; href: string; active: boolean }[];
}) {
  return (
    <div role="group" aria-label={label} className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <ul className="flex w-max gap-2">
        {options.map((o) => (
          <li key={o.href}>
            <Link
              href={o.href}
              scroll={false}
              aria-current={o.active ? "true" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors",
                o.active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {o.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
