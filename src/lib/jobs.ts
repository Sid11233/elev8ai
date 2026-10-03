import type { Database } from "@/lib/supabase/database.types";

export type Job = Database["public"]["Tables"]["jobs"]["Row"];
export type Company = Database["public"]["Tables"]["companies"]["Row"];
export type Skill = Database["public"]["Tables"]["skills"]["Row"];

// Proof type decides how a submission is verified / previewed before payment.
export const PROOF_TYPES = [
  "file_watermarked",
  "file_staging",
  "verified_event",
  "verified_publish",
] as const;
export type ProofType = (typeof PROOF_TYPES)[number];

export const PROOF_TYPE_LABELS: Record<ProofType, string> = {
  file_watermarked: "Watermarked preview until paid",
  file_staging: "Clean files released after payment",
  verified_event: "Verified by a booking/event record",
  verified_publish: "Verified the post is live",
};

// Every launch-ready job category and the proof type it maps to. This is the
// source of truth; the job_categories table is seeded from the same data for
// server-side validation and admin gating. A category not listed here can't be
// posted.
export const JOB_CATEGORY_DEFS = [
  // file_watermarked
  { slug: "clipping", label: "Clipping", proof: "file_watermarked" },
  { slug: "content", label: "Content & graphic design", proof: "file_watermarked" },
  { slug: "copywriting", label: "Copywriting", proof: "file_watermarked" },
  { slug: "voiceover", label: "Voiceover & audio", proof: "file_watermarked" },
  { slug: "podcast_editing", label: "Podcast editing", proof: "file_watermarked" },
  { slug: "logo_design", label: "Logo & thumbnail design", proof: "file_watermarked" },
  { slug: "deck_design", label: "Presentation & deck design", proof: "file_watermarked" },
  { slug: "photo_editing", label: "Photo editing & retouching", proof: "file_watermarked" },
  { slug: "cv_writing", label: "Resume & CV writing", proof: "file_watermarked" },
  { slug: "proofreading", label: "Proofreading & editing", proof: "file_watermarked" },
  { slug: "transcription", label: "Transcription", proof: "file_watermarked" },
  { slug: "translation", label: "Translation", proof: "file_watermarked" },
  { slug: "uiux_design", label: "UI/UX mockup design", proof: "file_watermarked" },
  { slug: "illustration", label: "Illustration & digital art", proof: "file_watermarked" },
  { slug: "blog_writing", label: "Blog & SEO writing", proof: "file_watermarked" },
  // file_staging
  { slug: "web_dev", label: "Web development", proof: "file_staging" },
  { slug: "landing_pages", label: "Landing page builds", proof: "file_staging" },
  { slug: "app_prototypes", label: "Mobile app prototypes", proof: "file_staging" },
  { slug: "automation", label: "Automation & bot builds", proof: "file_staging" },
  { slug: "chrome_extensions", label: "Chrome extension development", proof: "file_staging" },
  // verified_event
  { slug: "cold_calling", label: "Cold calling & appointment setting", proof: "verified_event" },
  { slug: "webinar_hosting", label: "Webinar & event hosting", proof: "verified_event" },
  { slug: "interview_scheduling", label: "Customer interview scheduling", proof: "verified_event" },
  // verified_publish
  { slug: "ugc_posting", label: "UGC & creator posting", proof: "verified_publish" },
  { slug: "affiliate_posting", label: "Affiliate & promotional posting", proof: "verified_publish" },
  { slug: "review_posting", label: "Review & testimonial posting", proof: "verified_publish" },
] as const satisfies ReadonlyArray<{ slug: string; label: string; proof: ProofType }>;

export const JOB_CATEGORIES = JOB_CATEGORY_DEFS.map((c) => c.slug);
export type JobCategory = (typeof JOB_CATEGORY_DEFS)[number]["slug"];

export const CATEGORY_LABELS = Object.fromEntries(
  JOB_CATEGORY_DEFS.map((c) => [c.slug, c.label]),
) as Record<string, string>;

export const CATEGORY_PROOF = Object.fromEntries(
  JOB_CATEGORY_DEFS.map((c) => [c.slug, c.proof]),
) as Record<string, ProofType>;

// High-level service tags a company picks at signup (kept small on purpose).
export const SERVICE_CATEGORIES = ["clipping", "cold_calling", "content", "web_dev"] as const;

export const JOB_STATUSES = ["draft", "open", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

export function categoryLabel(category: string) {
  return CATEGORY_LABELS[category] ?? category;
}

export function isJobCategory(value: unknown): value is JobCategory {
  return typeof value === "string" && value in CATEGORY_LABELS;
}

export function isJobStatus(value: unknown): value is JobStatus {
  return JOB_STATUSES.includes(value as JobStatus);
}
