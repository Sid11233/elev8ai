import { ExternalLink, FileText, Star } from "lucide-react";
import type { Metadata } from "next";

import { PersonLine } from "@/components/admin/person-line";
import { PageHeader } from "@/components/page-header";
import { FilterChips } from "@/components/talent/filter-chips";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getPeople } from "@/lib/admin-people";
import { formatDateTime } from "@/lib/datetime";
import { displayFileName } from "@/lib/submission-files";
import { createClient } from "@/lib/supabase/server";

import { GradeForm } from "./grade-form";

export const metadata: Metadata = { title: "Grading · Admin · Elev8ai" };

const TABS = [
  { value: "pending", label: "To grade" },
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "all", label: "All" },
] as const;

export default async function AdminGradingPage({ searchParams }: PageProps<"/admin/grading">) {
  const params = await searchParams;
  const tab = TABS.find((t) => t.value === params.status)?.value ?? "pending";

  const supabase = await createClient();
  let query = supabase
    .from("course_assignments")
    .select("*, course:courses(title, skill:skills(name))")
    .order("created_at", { ascending: tab === "pending" })
    .limit(100);
  if (tab !== "all") query = query.eq("status", tab);

  const [{ data: assignments }, { count: toGrade }] = await Promise.all([
    query,
    supabase
      .from("course_assignments")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
  ]);
  const list = assignments ?? [];

  const people = await getPeople(list.map((a) => a.user_id));
  const paths = list.flatMap((a) => a.file_paths);
  const fileUrls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage
      .from("assignment-files")
      .createSignedUrls(paths, 60 * 60);
    for (const it of data ?? []) if (it.path && it.signedUrl) fileUrls.set(it.path, it.signedUrl);
  }

  return (
    <>
      <PageHeader
        title="Grading"
        description="Grade course assignments. Target: within 72 hours."
      />
      <div className="mb-5">
        <FilterChips
          label="Assignment status"
          options={TABS.map((t) => ({
            label: t.value === "pending" && toGrade ? `To grade (${toGrade})` : t.label,
            href: `/admin/grading?status=${t.value}`,
            active: tab === t.value,
          }))}
        />
      </div>

      {!list.length ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <Star className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tab === "pending" ? "Nothing to grade right now." : "Nothing here yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((a) => (
            <Card key={a.id}>
              <CardContent className="grid gap-4 md:grid-cols-[1fr_minmax(0,20rem)]">
                <div className="min-w-0 space-y-3">
                  <PersonLine person={people.get(a.user_id)} />
                  <p className="text-sm">
                    <span className="font-medium">{a.course?.title}</span>
                    {a.course?.skill && (
                      <span className="text-muted-foreground"> · awards {a.course.skill.name}</span>
                    )}
                  </p>
                  {a.links.length > 0 && (
                    <ul className="space-y-1">
                      {a.links.map((l) => (
                        <li key={l} className="min-w-0">
                          <a
                            href={l}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"
                          >
                            <ExternalLink className="size-3.5 shrink-0" />
                            <span className="truncate">{l}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  {a.file_paths.map((p) => (
                    <a
                      key={p}
                      href={fileUrls.get(p)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex max-w-full items-center gap-1.5 text-sm text-primary"
                    >
                      <FileText className="size-3.5 shrink-0" />
                      <span className="truncate">{displayFileName(p)}</span>
                    </a>
                  ))}
                  {a.notes && (
                    <p className="text-sm whitespace-pre-line text-muted-foreground">{a.notes}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Submitted {formatDateTime(a.created_at)}
                  </p>
                </div>

                <div>
                  {a.status === "pending" ? (
                    <GradeForm assignmentId={a.id} userId={a.user_id} />
                  ) : (
                    <div className="space-y-2 text-sm">
                      <Badge
                        className={
                          a.status === "passed"
                            ? "border-0 bg-primary/15 text-primary"
                            : "border-0 bg-destructive/15 text-destructive"
                        }
                      >
                        {a.status === "passed" ? "Passed" : "Failed"}
                      </Badge>
                      {a.feedback && (
                        <p className="whitespace-pre-line text-muted-foreground">{a.feedback}</p>
                      )}
                      {a.graded_at && (
                        <p className="text-xs text-muted-foreground">
                          Graded {formatDateTime(a.graded_at)}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
