import type { Database } from "@/lib/supabase/database.types";

export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];

export const JOB_CATEGORIES = ["clipping", "cold_calling", "content", "web_dev"] as const;
export type JobCategory = (typeof JOB_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<JobCategory, string> = {
  clipping: "Clipping",
  cold_calling: "Cold calling",
  content: "Content",
  web_dev: "Web dev",
};

export const JOB_STATUSES = ["draft", "open", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category as JobCategory] ?? category;
}

export function isJobCategory(value: unknown): value is JobCategory {
  return JOB_CATEGORIES.includes(value as JobCategory);
}

export function isJobStatus(value: unknown): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus);
}
