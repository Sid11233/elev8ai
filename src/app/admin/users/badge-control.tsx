"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

import { awardBadge, revokeBadge } from "./actions";

type Skill = { id: string; name: string };

// Shows a user's badges (with remove) and a picker to award another.
export function BadgeControl({
  userId,
  badges,
  allSkills,
}: {
  userId: string;
  badges: { skill_id: string; name: string }[];
  allSkills: Skill[];
}) {
  const held = new Set(badges.map((b) => b.skill_id));
  const available = allSkills.filter((s) => !held.has(s.id));
  const [skillId, setSkillId] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {badges.length === 0 && <span className="text-xs text-muted-foreground">No badges</span>}
        {badges.map((b) => (
          <span key={b.skill_id} className="inline-flex items-center">
            <Badge className="gap-1 border-0 bg-primary/15 text-primary">
              {b.name}
              <form action={revokeBadge} className="inline">
                <input type="hidden" name="userId" value={userId} />
                <input type="hidden" name="skillId" value={b.skill_id} />
                <button type="submit" aria-label={`Remove ${b.name} badge`} className="ml-0.5">
                  <X className="size-3" />
                </button>
              </form>
            </Badge>
          </span>
        ))}
      </div>

      {available.length > 0 && (
        <form action={awardBadge} className="flex items-center gap-2">
          <input type="hidden" name="userId" value={userId} />
          <NativeSelect
            name="skillId"
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
            aria-label="Award a badge"
            className="h-9 max-w-48"
          >
            <option value="">Award badge…</option>
            {available.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" size="sm" variant="outline" disabled={!skillId}>
            Award
          </Button>
        </form>
      )}
    </div>
  );
}
