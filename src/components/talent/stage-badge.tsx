import { Badge } from "@/components/ui/badge";
import type { MyApplication } from "@/lib/my-jobs";
import { cn } from "@/lib/utils";

// Short status label for an application in My Jobs.
export function statusText(app: Pick<MyApplication, "status" | "latest" | "stage">): {
  label: string;
  tone: "muted" | "primary" | "warning" | "danger";
} {
  if (app.status === "pending") return { label: "Waiting for decision", tone: "muted" };
  if (app.status === "rejected") return { label: "Not selected", tone: "danger" };
  if (app.status === "withdrawn") return { label: "Withdrawn", tone: "muted" };
  const latest = app.latest;
  if (!latest) return { label: "Do the work", tone: "primary" };
  if (latest.status === "changes_requested") return { label: "Changes requested", tone: "warning" };
  if (latest.status === "submitted") return { label: "In review", tone: "muted" };
  if (latest.status === "rejected") return { label: "Work rejected", tone: "danger" };
  const paid = latest.payout?.status === "paid";
  return { label: paid ? "Paid" : "Approved · payout owed", tone: "primary" };
}

const TONES = {
  muted: "bg-secondary text-muted-foreground",
  primary: "bg-primary/15 text-primary",
  warning: "bg-amber-400/15 text-amber-300",
  danger: "bg-destructive/15 text-destructive",
};

export function StageBadge({ app }: { app: Pick<MyApplication, "status" | "latest" | "stage"> }) {
  const { label, tone } = statusText(app);
  return <Badge className={cn("border-0", TONES[tone])}>{label}</Badge>;
}
