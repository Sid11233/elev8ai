import { cn } from "@/lib/utils";

export function UserAvatar({
  name,
  src,
  className,
}: {
  name: string | null;
  src: string | null;
  className?: string;
}) {
  const initials =
    (name ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <span
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-semibold",
        className,
      )}
    >
      {src ? (
        // Avatars come from Supabase Storage or Google; a plain img avoids per-host image config.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" referrerPolicy="no-referrer" />
      ) : (
        initials
      )}
    </span>
  );
}
