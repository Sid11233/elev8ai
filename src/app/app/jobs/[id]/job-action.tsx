import { CheckCircle2, Clock, Lock, XCircle } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import type { getJobForTalent } from "@/lib/job-board";

import { withdrawApplication } from "../actions";
import { ApplyForm } from "./apply-form";

type JobForTalent = NonNullable<Awaited<ReturnType<typeof getJobForTalent>>>;

function Panel({
  icon,
  title,
  children,
  tone = "default",
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  tone?: "default" | "primary";
}) {
  return (
    <div
      className={
        tone === "primary"
          ? "space-y-3 rounded-xl border border-primary/30 bg-primary/5 p-4"
          : "space-y-3 rounded-xl border bg-secondary/40 p-4"
      }
    >
      <p className="flex items-center gap-2 font-medium">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}

// What the talent can do on a job page, depending on their application.
export function JobAction({ job }: { job: JobForTalent }) {
  const app = job.application;

  if (app?.status === "pending") {
    return (
      <Panel icon={<Clock className="size-4" />} title="Application sent">
        <p className="text-sm text-muted-foreground">
          We&apos;ll let you know when the company decides. You can track it in My Jobs.
        </p>
        {app.pitch && (
          <p className="rounded-lg bg-background/60 p-3 text-sm whitespace-pre-line">{app.pitch}</p>
        )}
        <form action={withdrawApplication.bind(null, app.id, job.id)}>
          <Button type="submit" variant="outline" size="sm">
            Withdraw application
          </Button>
        </form>
      </Panel>
    );
  }

  if (app?.status === "accepted") {
    return (
      <Panel
        tone="primary"
        icon={<CheckCircle2 className="size-4 text-primary" />}
        title="You're in!"
      >
        <p className="text-sm text-muted-foreground">
          Do the work, then submit your proof so you can get paid.
        </p>
        {app.decision_note && (
          <p className="rounded-lg bg-background/60 p-3 text-sm whitespace-pre-line">
            {app.decision_note}
          </p>
        )}
        <Button asChild className="h-11 w-full sm:w-auto">
          <Link href={`/app/my-jobs/${app.id}`}>Go to this job</Link>
        </Button>
      </Panel>
    );
  }

  if (app?.status === "rejected") {
    return (
      <Panel icon={<XCircle className="size-4" />} title="Not selected this time">
        {app.decision_note ? (
          <p className="text-sm whitespace-pre-line text-muted-foreground">{app.decision_note}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Keep applying: new jobs are posted every week.
          </p>
        )}
      </Panel>
    );
  }

  if (!job.acceptingApplications) {
    return (
      <Panel icon={<XCircle className="size-4" />} title="This job is closed">
        <p className="text-sm text-muted-foreground">It isn&apos;t taking applications any more.</p>
      </Panel>
    );
  }

  if (job.locked && job.skill) {
    return (
      <Panel
        tone="primary"
        icon={<Lock className="size-4" />}
        title={`Needs the ${job.skill.name} badge`}
      >
        <p className="text-sm text-muted-foreground">
          Pass the {job.skill.name} course to earn the badge and unlock this job.
        </p>
        <Button asChild className="h-11 w-full sm:w-auto">
          <Link href="/app/learn">Get the badge</Link>
        </Button>
      </Panel>
    );
  }

  // No application yet, or withdrawn (re-applying is allowed).
  return <ApplyForm jobId={job.id} />;
}
