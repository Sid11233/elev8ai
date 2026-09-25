import { Markdown } from "@/components/markdown";

export function LegalPage({ title, body }: { title: string; body: string }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">{title}</h1>
      <Markdown>{body}</Markdown>
    </main>
  );
}
