"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireOnboardedProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/validation/form-state";
import { isImage, isPdf, watermarkImage, watermarkPdf } from "@/lib/watermark";

export type PortfolioField = "title" | "url" | "file";

const schema = z.object({
  title: z.string().trim().max(160).optional(),
  description: z.string().trim().max(1000).optional(),
  kind: z.enum(["image", "pdf", "link"]),
  url: z.string().trim().max(500).optional(),
  file_path: z.string().trim().max(500).optional(),
});

// Add a portfolio item. For uploaded image/PDF items the clean original goes to
// the private 'portfolio' bucket and a watermarked preview (what companies see)
// is generated server-side. Link items store only the URL.
export async function addPortfolioItem(
  _prev: FormState<PortfolioField>,
  formData: FormData,
): Promise<FormState<PortfolioField>> {
  const profile = await requireOnboardedProfile();
  const parsed = schema.safeParse({
    title: (formData.get("title") as string) || undefined,
    description: (formData.get("description") as string) || undefined,
    kind: formData.get("kind"),
    url: (formData.get("url") as string) || undefined,
    file_path: (formData.get("file_path") as string) || undefined,
  });
  if (!parsed.success) return { message: "Check the fields and try again." };
  const { kind } = parsed.data;

  if (kind === "link") {
    if (!parsed.data.url || !/^https?:\/\/\S+\.\S+/.test(parsed.data.url)) {
      return { fieldErrors: { url: "Enter a full URL starting with https://" } };
    }
  } else if (!parsed.data.file_path || !parsed.data.file_path.startsWith(`${profile.user_id}/`)) {
    return { fieldErrors: { file: "Upload a file first" } };
  }

  let previewPath: string | null = null;
  if (kind !== "link" && parsed.data.file_path) {
    const admin = createAdminClient();
    const { data: file } = await admin.storage.from("portfolio").download(parsed.data.file_path);
    if (file) {
      try {
        const input = Buffer.from(await file.arrayBuffer());
        const base = parsed.data.file_path.replace(/\.[^.]+$/, "");
        if (isImage(file.type)) {
          previewPath = `${base}.preview.png`;
          await admin.storage
            .from("portfolio-previews")
            .upload(previewPath, await watermarkImage(input), {
              contentType: "image/png",
              upsert: true,
            });
        } else if (isPdf(file.type)) {
          previewPath = `${base}.preview.pdf`;
          await admin.storage
            .from("portfolio-previews")
            .upload(previewPath, await watermarkPdf(input), {
              contentType: "application/pdf",
              upsert: true,
            });
        }
      } catch {
        previewPath = null;
      }
    }
  }

  const supabase = await createClient();
  const { error } = await supabase.from("portfolio_items").insert({
    user_id: profile.user_id,
    title: parsed.data.title || null,
    description: parsed.data.description || null,
    kind,
    file_path: kind === "link" ? null : parsed.data.file_path,
    preview_path: previewPath,
    url: kind === "link" ? parsed.data.url : null,
  });
  if (error) return { message: "Couldn't add the item. Try again." };

  revalidatePath("/app/profile/portfolio");
  return { message: "ok" };
}

export async function setPortfolioVisibility(id: string, visibility: "companies" | "private") {
  await requireOnboardedProfile();
  const supabase = await createClient();
  await supabase.from("portfolio_items").update({ visibility }).eq("id", id);
  revalidatePath("/app/profile/portfolio");
}

export async function deletePortfolioItem(id: string) {
  await requireOnboardedProfile();
  const supabase = await createClient();
  await supabase.from("portfolio_items").delete().eq("id", id);
  revalidatePath("/app/profile/portfolio");
}

// Talent uploads an external certificate (shown Unverified until an admin checks).
export async function addExternalCertificate(
  _prev: FormState<"title" | "file">,
  formData: FormData,
): Promise<FormState<"title" | "file">> {
  const profile = await requireOnboardedProfile();
  const title = String(formData.get("title") ?? "").trim();
  const issuer = String(formData.get("issuer") ?? "").trim();
  const filePath = (formData.get("file_path") as string) || "";
  if (title.length < 2) return { fieldErrors: { title: "Enter the certificate title" } };
  if (!filePath.startsWith(`${profile.user_id}/`)) {
    return { fieldErrors: { file: "Upload the certificate file" } };
  }
  const supabase = await createClient();
  const { error } = await supabase.from("certificates").insert({
    user_id: profile.user_id,
    kind: "external",
    title: title.slice(0, 160),
    issuer: issuer.slice(0, 160) || null,
    file_path: filePath,
    status: "pending",
  });
  if (error) return { message: "Couldn't upload. Try again." };
  revalidatePath("/app/profile/portfolio");
  return { message: "ok" };
}
