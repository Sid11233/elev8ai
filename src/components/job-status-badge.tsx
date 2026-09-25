import { Badge } from "@/components/ui/badge";
import { type JobStatus, STATUS_LABELS } from "@/lib/jobs";
import { cn } from "@/lib/utils";

const STYLES: Record<JobStatus, string> = {
  open: "bg-primary/15 text-primary",
  draft: "bg-secondary text-muted-foreground",
  closed: "bg-destructive/15 text-destructive",
};

export function JobStatusBadge({ status }: { status: string }) {
  const s = (status in STYLES ? status : "draft") as JobStatus;
  return (
    <Badge variant="secondary" className={cn("border-0", STYLES[s])}>
      {STATUS_LABELS[s]}
    </Badge>
  );
}
