import "server-only";

import { createClient } from "@/lib/supabase/server";

// Short-lived download links for private submission files. Runs as the
// signed-in user, so storage RLS decides what they may see.
export async function signSubmissionFiles(paths: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(paths)];
  if (!unique.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.storage.from("submissions").createSignedUrls(unique, 60 * 60);
  const urls = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
  }
  return urls;
}

// "1727250000000-views-screenshot.png" -> "views-screenshot.png"
export function displayFileName(path: string) {
  return (path.split("/").pop() ?? path).replace(/^\d+-/, "");
}
