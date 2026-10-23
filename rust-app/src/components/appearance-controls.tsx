import {
  FONT_SIZES,
  PALETTES,
  TYPEFACES,
  paletteCustomProperties,
  typefaceCustomProperties,
  typefaceForPalette,
} from '@/lib/appearance.ts'
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

function facesForPalette(id: (typeof PALETTES)[number]['id']) {
  return TYPEFACES.find((typeface) => typeface.id === typefaceForPalette(id))?.faces ?? ''
}

export function PalettePicker({ compact = false }: { compact?: boolean }) {
  const { palette, setPalette } = useAppearance()

  if (compact) {
    return (
      <div role="radiogroup" aria-label="Theme" className="flex flex-wrap gap-1.5">
        {PALETTES.map((option) => {
          const selected = palette === option.id
          const faces = facesForPalette(option.id)
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${option.label}, ${faces}`}
              title={`${option.label} · ${faces}`}
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
        const faces = facesForPalette(option.id)
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${option.label}, ${faces}`}
            title={`${option.label} · ${faces}`}
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
            <span className="text-[10px] leading-tight text-muted-foreground">{faces}</span>
          </button>
        )
      })}
    </div>
  )
}

export function TypefacePicker({ compact = false }: { compact?: boolean }) {
  const { typeface, setTypeface } = useAppearance()

  if (compact) {
    return (
      <div role="radiogroup" aria-label="Typeface" className="flex flex-wrap gap-1.5">
        {TYPEFACES.map((option) => {
          const selected = typeface === option.id
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.faces}
              title={option.faces}
              onClick={() => setTypeface(option.id)}
              className={cn(
                'h-6 rounded-full px-2 text-[10px] outline-none ring-2 ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-ring',
                selected
                  ? 'bg-background text-foreground ring-foreground'
                  : 'bg-muted/60 text-muted-foreground ring-transparent hover:ring-foreground/30',
              )}
              style={{ fontFamily: typefaceCustomProperties(option.id)['--font-sans'] }}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div role="radiogroup" aria-label="Typeface" className="grid w-full grid-cols-3 gap-1.5">
      {TYPEFACES.map((option) => {
        const selected = typeface === option.id
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.faces}
            title={option.faces}
            onClick={() => setTypeface(option.id)}
            className={cn(
              'grid gap-0.5 rounded-lg border px-2 py-2 text-left outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50',
              selected
                ? 'border-foreground/20 bg-background shadow-sm'
                : 'border-transparent bg-muted/40 hover:bg-muted/70',
            )}
            style={{ fontFamily: typefaceCustomProperties(option.id)['--font-sans'] }}
          >
            <span className="text-xs font-medium">{option.label}</span>
            {option.label !== option.faces && (
              <span className="text-[10px] leading-tight text-muted-foreground">{option.faces}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
