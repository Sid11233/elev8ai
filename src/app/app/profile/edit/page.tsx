import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { requireOnboardedProfile } from "@/lib/auth";

import { ProfileEditForm } from "./profile-edit-form";

export const metadata: Metadata = { title: "Edit profile · Elev8ai" };

export default async function EditProfilePage() {
  const profile = await requireOnboardedProfile();
  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/app/profile"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Profile
      </Link>
      <PageHeader title="Edit profile" description="This is what companies see when you apply." />
      <ProfileEditForm profile={profile} />
    </div>
  );
}
