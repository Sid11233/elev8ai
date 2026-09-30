import { CompanyMobileNav, CompanyNav } from "@/components/company/company-nav";
import { CompanyLogo } from "@/components/company-logo";
import { Logo } from "@/components/brand/logo";
import { NotificationBellServer } from "@/components/notification-bell-server";
import { SignOutButton } from "@/components/sign-out-button";
import { requireCompany } from "@/lib/auth";

// Company area: only company users get past requireCompany().
export default async function CompanyLayout({ children }: LayoutProps<"/company">) {
  const { company } = await requireCompany();

  return (
    <div className="flex flex-1">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col overflow-y-auto border-r bg-sidebar p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-1 pt-1">
          <Logo href="/company" />
          <div className="ml-auto">
            <NotificationBellServer />
          </div>
        </div>
        <CompanyNav />
        <div className="mt-auto space-y-3 border-t pt-4">
          <div className="flex items-center gap-3">
            <CompanyLogo name={company.name} src={company.logo_url} />
            <p className="min-w-0 flex-1 truncate text-sm font-medium">{company.name}</p>
          </div>
          <SignOutButton />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur md:hidden">
          <CompanyMobileNav />
          <Logo href="/company" />
          <div className="ml-auto flex items-center gap-1">
            <NotificationBellServer />
            <SignOutButton />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
