import { cn } from "@/lib/utils";

export function CompanyLogo({
  name,
  src,
  className,
}: {
  name: string;
  src: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-secondary text-sm font-bold",
        className,
      )}
    >
      {src ? (
        // Logos live in the public company-logos bucket.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </span>
  );
}
