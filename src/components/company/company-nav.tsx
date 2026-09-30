"use client";

import {
  Banknote,
  Briefcase,
  FileCheck,
  Inbox,
  LayoutDashboard,
  Menu,
  MessageCircle,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/company", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/company/jobs", label: "My Jobs", icon: Briefcase },
  { href: "/company/applications", label: "Applications", icon: Inbox },
  { href: "/company/submissions", label: "Submissions", icon: FileCheck },
  { href: "/company/payouts", label: "Payouts", icon: Banknote },
  { href: "/company/messages", label: "Messages", icon: MessageCircle },
  { href: "/company/find-work", label: "Find work", icon: Search },
  { href: "/company/profile", label: "Company profile", icon: UserRound },
];

export function CompanyNav({ onNavigate }: { onNavigate?: () => void }) {
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

export function CompanyMobileNav() {
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
            Elev8<span className="text-primary">ai</span>
          </SheetTitle>
        </SheetHeader>
        <CompanyNav onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
