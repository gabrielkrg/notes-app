import { FONT_SIZES, PALETTES, paletteCustomProperties } from '@/lib/appearance.ts'
import { useAppearance } from '@/lib/appearance-provider.tsx'
import { cn } from '@/lib/utils'

export function FontSizePicker({ compact = false }: { compact?: boolean }) {
  const { fontSize, setFontSize } = useAppearance()

  return (
    <div
      role="radiogroup"
      aria-label="Font size"
      className={cn(
        'rounded-lg border bg-muted/60 p-0.5',
        compact ? 'flex w-full' : 'inline-flex',
      )}
    >
      {FONT_SIZES.map((option) => {
        const selected = fontSize === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            title={`${option.label} (${option.value})`}
            onClick={() => setFontSize(option.id)}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-xs text-muted-foreground outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              compact ? 'h-7 min-w-0 flex-1 px-1.5' : 'h-8 min-w-8 px-2',
              selected && 'bg-background text-foreground shadow-sm',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function PalettePicker({ compact = false }: { compact?: boolean }) {
  const { palette, setPalette } = useAppearance()

  if (compact) {
    return (
      <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-1.5">
        {PALETTES.map((option) => {
          const selected = palette === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option.label}, ${option.faces}`}
              title={`${option.label} · ${option.faces}`}
              onClick={() => setPalette(option.id)}
              className={cn(
                'size-6 rounded-full outline-none ring-2 ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-ring',
                selected ? 'ring-foreground' : 'ring-transparent hover:ring-foreground/30',
              )}
              style={{ background: option.swatch }}
            />
          )
        })}
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label="Theme" className="grid w-full grid-cols-3 gap-1.5">
      {PALETTES.map((option) => {
        const selected = palette === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${option.label}, ${option.faces}`}
            title={`${option.label} · ${option.faces}`}
            onClick={() => setPalette(option.id)}
            className={cn(
              'grid gap-1 rounded-lg border px-2 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              selected
                ? 'border-foreground/20 bg-background shadow-sm'
                : 'border-transparent bg-muted/40 hover:bg-muted/70',
            )}
            style={{ fontFamily: paletteCustomProperties(option.id)['--font-sans'] }}
          >
            <span className="size-4 rounded-full" style={{ background: option.swatch }} />
            <span className="text-xs font-medium">{option.label}</span>
            <span className="text-[10px] leading-tight text-muted-foreground">{option.faces}</span>
          </button>
        )
      })}
    </div>
  )
}
