import type { Metadata } from "next";

import { LegalPage } from "@/components/marketing/legal-page";
import { readLegalDoc } from "@/lib/legal";

export const metadata: Metadata = { title: "terms · Elev8ai" };

export default async function Page() {
  const { title, body } = await readLegalDoc("terms");
  return <LegalPage title={title} body={body} />;
}
