import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Inter: body, UI, buttons, nav, forms. Tabular figures available via tnum.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

// Fraunces: display headlines and section headings, bold, used sparingly.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: "lockedinnn — Level up, get paid!",
    template: "%s",
  },
  description: "Level up, get paid! Paid micro-jobs and skills that unlock better-paying work.",
  openGraph: {
    title: "lockedinnn — Level up, get paid!",
    description:
      "A marketplace where young people take paid micro-jobs and learn skills that unlock better-paying work.",
    siteName: "lockedinnn",
    type: "website",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
