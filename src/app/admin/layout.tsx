import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/auth";

// Admin area: only admins get past requireAdmin(); everyone else is redirected.
// Placeholder shell; the full sidebar arrives in Phase 1c.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">Elev8ai Admin</span>
        <SignOutButton />
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
