"use client";

import {
  Banknote,
  Briefcase,
  Building2,
  FileCheck,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Star,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/companies", label: "Companies", icon: Building2 },
  { href: "/admin/jobs", label: "Jobs", icon: Briefcase },
  { href: "/admin/applications", label: "Applications", icon: Inbox },
  { href: "/admin/submissions", label: "Submissions", icon: FileCheck },
  { href: "/admin/payouts", label: "Payouts", icon: Banknote },
  { href: "/admin/courses", label: "Courses", icon: GraduationCap },
  { href: "/admin/grading", label: "Grading", icon: Star },
  { href: "/admin/messages", label: "Messages", icon: MessageCircle },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function AdminNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ href, label, icon: Icon, exact }) => (
        <Link
          key={href}
          href={href}
          onClick={onNavigate}
          aria-current={isActive(href, exact) ? "page" : undefined}
          className={cn(
            "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
            isActive(href, exact) && "bg-sidebar-accent text-primary hover:text-primary",
          )}
        >
          <Icon className="size-4.5" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

// Phone: menu button that opens the same navigation in a drawer.
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar p-4">
        <SheetHeader className="p-0 pb-4">
          <SheetTitle>
            Elev8<span className="text-primary">ai</span> Admin
          </SheetTitle>
        </SheetHeader>
        <AdminNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
