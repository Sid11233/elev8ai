import { Banknote, GraduationCap, Megaphone, Scissors, Send, Video } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { CompanyLogo } from "@/components/company-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getLandingData } from "@/lib/marketing";
import { formatCents } from "@/lib/money";

export const metadata: Metadata = {
  title: "Elev8ai — Get paid for real work. Learn skills that pay more.",
  description:
    "Elev8ai is a marketplace where young people take paid micro-jobs and learn skills that unlock better-paying work.",
};

const STEPS = [
  {
    icon: Send,
    title: "Sign up and apply",
    text: "Create a profile and apply to open jobs from real companies.",
  },
  {
    icon: Video,
    title: "Do the work",
    text: "Get accepted, chat with the company, and submit your proof of work.",
  },
  {
    icon: Banknote,
    title: "Get paid",
    text: "Approved work is paid out every week. Learn skills to unlock jobs that pay more.",
  },
];

const CATEGORIES = [
  { icon: Scissors, label: "Clipping", text: "Turn long videos into short, punchy clips." },
  { icon: Megaphone, label: "Cold calling", text: "Book meetings and set appointments." },
  { icon: Video, label: "Content", text: "Shoot and edit short-form product content." },
  { icon: GraduationCap, label: "Web dev", text: "Build small website features." },
];

const FAQ = [
  {
    q: "Who can join?",
    a: "Anyone aged 18 or over. You'll be asked for your date of birth when you sign up.",
  },
  {
    q: "How do I get paid?",
    a: "Approved work is paid out weekly by bank transfer, MCB Juice, Wise or PayPal. The minimum payout is $10.",
  },
  {
    q: "Do courses cost money?",
    a: "Yes — you pay once for a course. Passing its assignment earns a badge that unlocks higher-paying jobs.",
  },
  {
    q: "Is it really free to start?",
    a: "Yes. Signing up and taking starter jobs is free. Courses are optional.",
  },
];

export default async function LandingPage() {
  const { companies, courses, openJobs } = await getLandingData();

  return (
    <main>
      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16 text-center sm:py-24">
        <Badge className="mb-4 border-0 bg-primary/15 text-primary">For ambitious 18+ talent</Badge>
        <h1 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
          Get paid for real work. <span className="text-primary">Learn skills that pay more.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Elev8ai connects you to paid micro-jobs from real companies — clipping, content, cold
          calling and web dev — and courses that unlock better-paying work.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild className="h-12 px-8 text-base">
            <Link href="/login">Start earning</Link>
          </Button>
          <Button asChild variant="outline" className="h-12 px-8 text-base">
            <Link href="#how">How it works</Link>
          </Button>
        </div>
        {openJobs > 0 && (
          <p className="mt-4 text-sm text-muted-foreground">{openJobs} open jobs right now</p>
        )}
      </section>

      {/* How it works */}
      <section id="how" className="border-t bg-card/40">
        <div className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold">How it works</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <Card key={s.title}>
                <CardContent className="space-y-2">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <s.icon className="size-6" />
                  </div>
                  <p className="text-sm font-semibold text-muted-foreground">Step {i + 1}</p>
                  <p className="font-semibold">{s.title}</p>
                  <p className="text-sm text-muted-foreground">{s.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-center text-2xl font-semibold">Jobs you can take</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Card key={c.label}>
              <CardContent className="space-y-2">
                <c.icon className="size-6 text-primary" />
                <p className="font-semibold">{c.label}</p>
                <p className="text-sm text-muted-foreground">{c.text}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured courses */}
      {courses.length > 0 && (
        <section className="border-t bg-card/40">
          <div className="mx-auto w-full max-w-5xl px-6 py-16">
            <h2 className="text-center text-2xl font-semibold">Courses that unlock better jobs</h2>
            <div className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
              {courses.map((course) => (
                <Card key={course.slug}>
                  <CardContent className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{course.title}</p>
                      <span className="shrink-0 font-semibold text-primary">
                        {course.price_cents === 0 ? "Free" : formatCents(course.price_cents)}
                      </span>
                    </div>
                    {course.description && (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {course.description}
                      </p>
                    )}
                    {course.skill && <Badge variant="secondary">Awards {course.skill.name}</Badge>}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Companies */}
      {companies.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold">Companies hiring on Elev8ai</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {companies.map((c) => (
              <Card key={c.name}>
                <CardContent className="flex items-center gap-3">
                  <CompanyLogo name={c.name} src={c.logo_url} />
                  <div className="min-w-0">
                    <p className="font-medium">{c.name}</p>
                    {c.description && (
                      <p className="line-clamp-1 text-sm text-muted-foreground">{c.description}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="border-t bg-card/40">
        <div className="mx-auto w-full max-w-2xl px-6 py-16">
          <h2 className="text-center text-2xl font-semibold">Questions</h2>
          <div className="mt-8 space-y-3">
            {FAQ.map((item) => (
              <details key={item.q} className="rounded-xl border bg-card p-4">
                <summary className="cursor-pointer font-medium">{item.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto w-full max-w-5xl px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold">Ready to get paid for real work?</h2>
        <p className="mt-3 text-muted-foreground">
          It&apos;s free to start. You must be 18 or older.
        </p>
        <Button asChild className="mt-6 h-12 px-8 text-base">
          <Link href="/login">Create your account</Link>
        </Button>
      </section>
    </main>
  );
}
