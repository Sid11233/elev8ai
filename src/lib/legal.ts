import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

// Reads a markdown legal doc from /content. Paste final legal text into those
// files; the pages render whatever is there.
const DOCS = {
  terms: { file: "terms.md", title: "Terms of Service" },
  privacy: { file: "privacy.md", title: "Privacy Policy" },
  "contractor-agreement": {
    file: "contractor-agreement.md",
    title: "Independent Contractor Agreement",
  },
} as const;

export type LegalDoc = keyof typeof DOCS;

export async function readLegalDoc(doc: LegalDoc) {
  const { file, title } = DOCS[doc];
  try {
    const body = await readFile(path.join(process.cwd(), "content", file), "utf8");
    return { title, body };
  } catch {
    return { title, body: `# ${title}\n\nComing soon.` };
  }
}
