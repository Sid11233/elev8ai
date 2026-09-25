import { ExternalLink, FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/datetime";
import { formatCents } from "@/lib/money";
import type { Payout, Submission } from "@/lib/my-jobs";
import { displayFileName } from "@/lib/submission-files";
import { cn } from "@/lib/utils";

const STATUS: Record<string, { label: string; className: string }> = {
  submitted: { label: "In review", className: "bg-secondary text-muted-foreground" },
  changes_requested: { label: "Changes requested", className: "bg-amber-400/15 text-amber-300" },
  approved: { label: "Approved", className: "bg-primary/15 text-primary" },
  rejected: { label: "Rejected", className: "bg-destructive/15 text-destructive" },
};

// One proof-of-work attempt: links, files, units, notes and the review outcome.
export function SubmissionCard({
  submission,
  payout,
  fileUrls,
  unitLabel,
}: {
  submission: Submission;
  payout?: Payout | null;
  fileUrls: Map<string, string>;
  unitLabel: string | null;
}) {
  const status = STATUS[submission.status] ?? STATUS.submitted;

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          Submitted {formatDateTime(submission.created_at)}
        </p>
        <Badge className={cn("border-0", status.className)}>{status.label}</Badge>
      </div>

      {submission.links.length > 0 && (
        <ul className="space-y-1">
          {submission.links.map((link) => (
            <li key={link} className="min-w-0">
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"
              >
                <ExternalLink className="size-3.5 shrink-0" />
                <span className="truncate">{link}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {submission.file_paths.length > 0 && (
        <ul className="space-y-1">
          {submission.file_paths.map((path) => (
            <li key={path}>
              <a
                href={fileUrls.get(path)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{displayFileName(path)}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {unitLabel && submission.units_claimed && (
        <p className="text-sm">
          {submission.units_claimed} {unitLabel}
          {submission.units_claimed === 1 ? "" : "s"} claimed
          {submission.units_approved && submission.units_approved !== submission.units_claimed && (
            <span className="text-muted-foreground"> · {submission.units_approved} approved</span>
          )}
        </p>
      )}

      {submission.notes && (
        <p className="text-sm whitespace-pre-line text-muted-foreground">{submission.notes}</p>
      )}

      {submission.reviewer_note && (
        <div className="rounded-lg bg-secondary/60 p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-muted-foreground">Reviewer note</p>
          <p className="whitespace-pre-line">{submission.reviewer_note}</p>
        </div>
      )}

      {payout && (
        <p className="text-sm font-medium text-primary">
          {formatCents(payout.amount_cents)}{" "}
          {payout.status === "paid" && payout.paid_at
            ? `paid ${formatDateTime(payout.paid_at)}`
            : "owed · paid out on Fridays"}
        </p>
      )}
    </div>
  );
}
