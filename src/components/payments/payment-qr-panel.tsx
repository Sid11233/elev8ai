import { formatCents } from "@/lib/money";
import { paymentUrl, qrDataUri } from "@/lib/payment-request";

// Shows the lockedinnn-hosted payment QR for an approved job. The QR encodes a
// link to /p/<username>/<token>; the company scans it, lands on the hosted page,
// and pays from their own Juice app. The QR is generated fresh server-side here
// on every render — never stored or client-cached.
export async function PaymentQrPanel({
  username,
  token,
  referenceCode,
  amountCents,
}: {
  username: string;
  token: string;
  referenceCode: string;
  amountCents: number;
}) {
  const url = paymentUrl(username, token);
  const qr = await qrDataUri(url);

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
      <p className="font-medium">Pay the freelancer by Juice</p>
      <p className="mt-1 text-muted-foreground">
        Scan this to open their secure payment page, then pay{" "}
        <span className="font-medium text-foreground">{formatCents(amountCents)}</span> from your own
        Juice app. Clean files unlock once they confirm receipt.
      </p>
      {/* Generated QR data-URI; regenerated server-side each render. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={qr}
        alt="Payment QR"
        className="mt-3 size-44 rounded-lg border bg-background object-contain"
      />
      <p className="mt-2 text-xs text-muted-foreground">
        Reference <span className="font-medium text-foreground">{referenceCode}</span>
      </p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-xs text-primary"
      >
        Open payment page
      </a>
    </div>
  );
}
