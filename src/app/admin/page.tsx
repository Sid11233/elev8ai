import {
  Banknote,
  Briefcase,
  Building2,
  FileCheck,
  GraduationCap,
  Inbox,
  Star,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";

export const metadata: Metadata = { title: "Admin · Elev8ai" };

const SECTIONS = [
  { href: "/admin/applications", label: "Applications", hint: "Waiting for review", icon: Inbox },
  { href: "/admin/submissions", label: "Submissions", hint: "Proof to approve", icon: FileCheck },
  { href: "/admin/grading", label: "Grading", hint: "Assignments to grade", icon: Star },
  { href: "/admin/payouts", label: "Payouts", hint: "Owed to talent", icon: Banknote },
  { href: "/admin/jobs", label: "Jobs", hint: "Post and manage jobs", icon: Briefcase },
  { href: "/admin/companies", label: "Companies", hint: "Your 4 companies", icon: Building2 },
  { href: "/admin/courses", label: "Courses", hint: "Lessons and pricing", icon: GraduationCap },
  { href: "/admin/users", label: "Users", hint: "Talent and badges", icon: Users },
];

export default function AdminHomePage() {
  return (
    <>
      <PageHeader title="Admin" description="Review queues and everything you manage." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SECTIONS.map(({ href, label, hint, icon: Icon }) => (
          <Link key={href} href={href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/40">
              <CardContent className="space-y-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground">{hint}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
