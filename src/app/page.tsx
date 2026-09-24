import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Elev8ai</h1>
      <p className="text-muted-foreground">Get paid for real work. Learn skills that pay more.</p>
      <Button asChild className="mt-4 h-11 px-6">
        <Link href="/login">Get started</Link>
      </Button>
    </main>
  );
}
