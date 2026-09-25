import { CalendarClock, Lock, Users } from "lucide-react";
import Link from "next/link";

import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/datetime";
import type { BoardJob } from "@/lib/job-board";
import { categoryLabel } from "@/lib/jobs";
import { formatPay, formatPayCap } from "@/lib/money";
import { cn } from "@/lib/utils";

export function JobCard({ job }: { job: BoardJob }) {
  const cap = formatPayCap(job);

  return (
    <Card
      className={cn(
        "relative transition-colors hover:border-primary/40",
        job.locked && "opacity-80",
      )}
    >
      <CardContent className="space-y-3">
        <div className="flex items-start gap-3">
          <CompanyLogo name={job.company?.name ?? "?"} src={job.company?.logo_url ?? null} />
          <div className="min-w-0 flex-1">
            <h2 className="leading-snug font-semibold">
              {/* Stretched link: the whole card opens the job. */}
              <Link href={`/app/jobs/${job.id}`} className="after:absolute after:inset-0">
                {job.title}
              </Link>
            </h2>
            <p className="text-sm text-muted-foreground">{job.company?.name}</p>
          </div>
          {job.locked && (
            <Lock className="size-4 shrink-0 text-muted-foreground" aria-label="Locked" />
          )}
        </div>

        <div>
          <p className="text-lg font-semibold text-primary">{formatPay(job)}</p>
          {cap && <p className="text-xs text-muted-foreground">{cap}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          <Badge variant="secondary">{categoryLabel(job.category)}</Badge>
          <span className="inline-flex items-center gap-1">
            <Users className="size-3.5" />
            {job.slots} {job.slots === 1 ? "spot" : "spots"}
          </span>
          {job.deadline && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock className="size-3.5" />
              Due {formatDate(job.deadline)}
            </span>
          )}
        </div>

        {job.locked && job.skill && (
          <div className="relative z-10 flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-3 py-2 text-sm">
            <span>Needs the {job.skill.name} badge</span>
            <Link href="/app/learn" className="font-medium text-primary">
              Get the badge
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
