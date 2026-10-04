import "server-only";

import { createClient } from "@/lib/supabase/server";

const BLOCKED = [
  // shorteners
  "bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "buff.ly", "rebrand.ly", "cutt.ly",
  // messaging / community invites
  "wa.me", "whatsapp.com", "t.me", "telegram.me", "telegram.org", "discord.gg", "discord.com",
  // expiring transfer
  "wetransfer.com", "we.tl",
];

export type LinkCheck = {
  status: "ok" | "inaccessible" | "blocked";
  domain: string | null;
  reason?: string;
};

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

function isIpHost(host: string) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

function matchesDomain(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

async function safeBrowsingFlagged(url: string): Promise<boolean> {
  const key = process.env.GOOGLE_SAFE_BROWSING_KEY;
  if (!key) return false; // guarded: no key -> skip the check
  try {
    const res = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${key}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          client: { clientId: "lockedinnn", clientVersion: "1.0" },
          threatInfo: {
            threatTypes: ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE"],
            platformTypes: ["ANY_PLATFORM"],
            threatEntryTypes: ["URL"],
            threatEntries: [{ url }],
          },
        }),
      },
    );
    const data = await res.json();
    return Array.isArray(data.matches) && data.matches.length > 0;
  } catch {
    return false;
  }
}

// Validate a job link for a given role: https only, allowlisted domain for that
// role, no shorteners/messaging/IP hosts, redirect target re-checked, reachable,
// and (when configured) clean on Google Safe Browsing.
export async function validateJobLink(
  url: string,
  role: "source" | "reference",
): Promise<LinkCheck> {
  const host = hostOf(url);
  if (!host) return { status: "blocked", domain: null, reason: "Use a full https:// link" };
  if (isIpHost(host)) return { status: "blocked", domain: host, reason: "IP-address links aren't allowed" };
  if (BLOCKED.some((b) => matchesDomain(host, b))) {
    return { status: "blocked", domain: host, reason: "This kind of link isn't allowed" };
  }

  const supabase = await createClient();
  const { data: allow } = await supabase.from("link_domain_allowlist").select("domain, allowed_roles");
  const entry = (allow ?? []).find((a) => matchesDomain(host, a.domain));
  if (!entry || !entry.allowed_roles.includes(role)) {
    return { status: "blocked", domain: host, reason: `${host} isn't allowed for ${role} links` };
  }

  // Follow redirects and re-check the final domain, then confirm reachability.
  let finalUrl = url;
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    finalUrl = res.url || url;
    const finalHost = hostOf(finalUrl);
    if (!finalHost || !(entry && matchesDomain(finalHost, entry.domain))) {
      const reEntry = (allow ?? []).find((a) => finalHost && matchesDomain(finalHost, a.domain));
      if (!reEntry || !reEntry.allowed_roles.includes(role)) {
        return { status: "blocked", domain: finalHost, reason: "Link redirects to a blocked domain" };
      }
    }
    if (!res.ok) return { status: "inaccessible", domain: host, reason: "Link isn't reachable" };
  } catch {
    return { status: "inaccessible", domain: host, reason: "Couldn't reach the link" };
  }

  if (await safeBrowsingFlagged(finalUrl)) {
    return { status: "blocked", domain: host, reason: "Link flagged as unsafe" };
  }

  return { status: "ok", domain: host };
}
