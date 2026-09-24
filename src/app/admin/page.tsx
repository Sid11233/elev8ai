import type { Metadata } from "next";

export const metadata: Metadata = { title: "Admin · Elev8ai" };

export default function AdminHomePage() {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <p className="text-muted-foreground">Companies, jobs and review queues will live here.</p>
    </div>
  );
}
