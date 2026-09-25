import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/user-avatar";
import type { PersonSummary } from "@/lib/admin-people";

// Avatar, name, @username, country and badges for admin queues.
export function PersonLine({ person }: { person: PersonSummary | undefined }) {
  if (!person) return <p className="text-sm text-muted-foreground">Unknown user</p>;
  return (
    <div className="flex items-center gap-3">
      <UserAvatar name={person.full_name} src={person.avatar_url} />
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">
          {person.full_name}{" "}
          <span className="font-normal text-muted-foreground">@{person.username}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {person.country}
          {person.badges.map((b) => (
            <Badge key={b} className="border-0 bg-primary/15 text-primary">
              {b}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
