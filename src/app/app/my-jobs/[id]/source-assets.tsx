"use client";

import { ExternalLink, FileText, Flag } from "lucide-react";
import { useState, useTransition } from "react";

import { reportBrokenLink } from "../actions";

type Asset = {
  id: string;
  kind: string;
  label: string | null;
  url: string | null;
  domain: string | null;
  signedUrl?: string;
};

// Source assets the company provided, visible only to the accepted talent.
// Links show the real domain, a leaving-lockedinnn notice, and a report button.
export function SourceAssets({ jobId, assets }: { jobId: string; assets: Asset[] }) {
  if (!assets.length) return null;
  return (
    <ul className="space-y-2">
      {assets.map((a) => (
        <AssetRow key={a.id} jobId={jobId} asset={a} />
      ))}
    </ul>
  );
}

function AssetRow({ jobId, asset }: { jobId: string; asset: Asset }) {
  const [pending, start] = useTransition();
  const [reported, setReported] = useState(false);

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm">
      {asset.kind === "link" ? (
        <a
          href={asset.url ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 text-primary"
          title={`Leaving lockedinnn to ${asset.domain}`}
        >
          <ExternalLink className="size-3.5 shrink-0" />
          <span className="truncate">{asset.label || asset.domain}</span>
        </a>
      ) : (
        <a
          href={asset.signedUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-w-0 items-center gap-1.5 text-primary"
        >
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{asset.label || "File"}</span>
        </a>
      )}
      {asset.kind === "link" &&
        (reported ? (
          <span className="shrink-0 text-xs text-muted-foreground">Reported</span>
        ) : (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                await reportBrokenLink(asset.id, jobId);
                setReported(true);
              })
            }
            className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline hover:text-foreground"
          >
            <Flag className="size-3" /> Can&apos;t open this
          </button>
        ))}
    </li>
  );
}
