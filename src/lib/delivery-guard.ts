// Storage / file-transfer domains that would let work leave the platform before
// payment is settled. Used to block talent chat links/attachments and submission
// notes while a payment request is open.
const DELIVERY_BLOCK = [
  "drive.google.com",
  "docs.google.com",
  "dropbox.com",
  "onedrive.live.com",
  "sharepoint.com",
  "wetransfer.com",
  "we.tl",
  "mega.nz",
  "mediafire.com",
  "box.com",
  "icloud.com",
];

export function hasBlockedDeliveryLink(text: string): boolean {
  const urls = text.match(/https?:\/\/[^\s]+/gi) ?? [];
  return urls.some((u) => {
    try {
      const host = new URL(u).hostname.replace(/^www\./, "").toLowerCase();
      return DELIVERY_BLOCK.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
      return false;
    }
  });
}
