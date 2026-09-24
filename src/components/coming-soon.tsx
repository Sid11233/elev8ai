import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

// Placeholder body for sections that are built in a later phase.
export function ComingSoon({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Icon className="size-6" />
        </span>
        <p className="max-w-sm text-sm text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
