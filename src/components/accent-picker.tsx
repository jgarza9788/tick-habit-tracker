import { useState } from "react"
import { CheckIcon, PaletteIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { ACCENTS, applyAccent, currentAccent, type AccentId } from "@/lib/accents"
import { cn } from "@/lib/utils"

/** Palette button (sits next to the light/dark toggle) that opens a row of accent colors. */
export function AccentPicker() {
  const [accent, setAccent] = useState<AccentId>(currentAccent)

  const choose = (id: AccentId) => {
    applyAccent(id)
    setAccent(id)
  }

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon-lg" aria-label="Accent color" title="Accent color" />}>
        <PaletteIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto gap-3 p-3">
        <PopoverTitle className="text-sm font-medium">Accent color</PopoverTitle>
        <div role="radiogroup" aria-label="Accent color" className="flex gap-2">
          {ACCENTS.map((a) => {
            const selected = a.id === accent
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={a.name}
                title={a.name}
                onClick={() => choose(a.id)}
                style={{ background: a.swatch }}
                className={cn(
                  "press grid size-9 place-items-center rounded-full text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected && "ring-2 ring-foreground ring-offset-2 ring-offset-popover"
                )}
              >
                {selected && <CheckIcon className="size-4 tick-pop" strokeWidth={3} />}
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
