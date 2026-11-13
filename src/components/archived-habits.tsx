import { ArchiveRestoreIcon, Trash2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { habitHref } from "@/lib/route"
import type { Habit } from "@/lib/habits"

/** Collapsed list of archived habits: still viewable, restorable or deletable. */
export function ArchivedHabits({ habits, onRestore, onDelete }: { habits: Habit[]; onRestore: (h: Habit) => void; onDelete: (h: Habit) => void }) {
  if (!habits.length) return null
  return (
    <details className="rounded-xl border border-dashed p-3">
      <summary className="cursor-pointer text-sm font-medium text-muted-foreground select-none">Archived ({habits.length})</summary>
      <ul className="mt-2 flex flex-col">
        {habits.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-2 py-1">
            <a href={habitHref(h.id)} className="min-w-0 truncate text-sm underline-offset-4 hover:underline">
              {h.emoji} {h.name}
            </a>
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="sm" onClick={() => onRestore(h)} aria-label={`Restore ${h.name}`}>
                <ArchiveRestoreIcon data-icon="inline-start" />
                Restore
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => onDelete(h)} aria-label={`Delete ${h.name}`}>
                <Trash2Icon />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </details>
  )
}
