import { z } from "zod";

export const SUBMISSION_FILE_MAX_BYTES = 10 * 1024 * 1024;
export const SUBMISSION_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;
export const SUBMISSION_MAX_FILES = 10;
export const SUBMISSION_MAX_LINKS = 20;

export const submissionSchema = z
  .object({
    // One URL per line.
    links: z
      .string()
      .transform((v) =>
        v
          .split(/\s+/)
          .map((l) => l.trim())
          .filter(Boolean),
      )
      .pipe(
        z
          .array(z.url({ protocol: /^https?$/, message: "Links must start with https://" }))
          .max(SUBMISSION_MAX_LINKS, `Up to ${SUBMISSION_MAX_LINKS} links`),
      ),
    // JSON array of storage paths uploaded by the browser.
    file_paths: z
      .string()
      .transform((v, ctx) => {
        try {
          return v ? (JSON.parse(v) as unknown) : [];
        } catch {
          ctx.addIssue({ code: "custom", message: "Invalid file list" });
          return z.NEVER;
        }
      })
      .pipe(z.array(z.string().max(500)).max(SUBMISSION_MAX_FILES)),
    notes: z.string().trim().max(2000, "Keep notes under 2000 characters"),
    units: z.string().trim(),
  })
  .refine((s) => s.links.length > 0 || s.file_paths.length > 0, {
    path: ["links"],
    message: "Add at least one link or file as proof",
  });

export type SubmissionField = "links" | "files" | "notes" | "units";
