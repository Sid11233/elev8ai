import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";

import { getJobFormOptions } from "../form-options";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "New job · Admin · Elev8ai" };

export default async function NewJobPage() {
  const { companies, skills } = await getJobFormOptions();
  return (
    <>
      <PageHeader title="New job" />
      <JobForm companies={companies} skills={skills} />
    </>
  );
}
