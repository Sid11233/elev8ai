"use client";

import { useRouter } from "next/navigation";

import { NativeSelect } from "@/components/ui/native-select";

// A category dropdown that navigates to the chosen option's href. Used where the
// full category list is too long for filter chips.
export function CategoryFilter({
  value,
  options,
}: {
  value: string;
  options: { label: string; value: string; href: string }[];
}) {
  const router = useRouter();
  const hrefByValue = new Map(options.map((o) => [o.value, o.href]));
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">Category</p>
      <NativeSelect
        aria-label="Category"
        value={value}
        onChange={(e) => {
          const href = hrefByValue.get(e.target.value);
          if (href) router.push(href);
        }}
        className="max-w-xs"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
