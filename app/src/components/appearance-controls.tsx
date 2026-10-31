import { Check } from 'lucide-react'
import {
  FONT_SIZES,
  PALETTES,
  TYPEFACES,
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

  const previews: Record<string, [string, string, string]> = {
    ink: ['#fcfcfa', '#e3e9df', '#326b58'], sepia: ['#f7f0e0', '#e5d7b9', '#795939'],
    forest: ['#edf4ec', '#d0dfce', '#41654b'], slate: ['#eff3f8', '#d7e0ea', '#42617f'],
    dusk: ['#f9eeed', '#e8cecf', '#895c66'], midnight: ['#20283e', '#151b2d', '#b7c8e4'],
    abyss: ['#151f31', '#0e1522', '#82a8df'],
  }
  return (
    <div role="radiogroup" aria-label="Theme" className="palette-options">
      {PALETTES.map((option) => {
        const selected = palette === option.id
        const [background, sidebar, ink] = previews[option.id]
        return <button key={option.id} type="button" role="radio" aria-checked={selected}
          aria-label={`${option.label}, ${facesForPalette(option.id)}`} title={`${option.label} · ${facesForPalette(option.id)}`}
          onClick={() => setPalette(option.id)} className="palette-option">
          <span aria-hidden="true" className="palette-mini" style={{ '--preview-bg': background, '--preview-sidebar': sidebar, '--preview-ink': ink } as React.CSSProperties}>
            <span className="palette-mini-sidebar" /><span className="palette-mini-page"><span className="palette-mini-line block" /><span className="palette-mini-line block" /><span className="palette-mini-line block" /></span>
          </span>
          <span className="palette-option-label">{option.label}{selected && <Check />}</span>
        </button>
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
    <select aria-label="Reading typeface" value={typeface} onChange={(event) => setTypeface(event.target.value as typeof typeface)} className="typeface-select">
      {TYPEFACES.map((option) => <option key={option.id} value={option.id}>{option.faces}</option>)}
    </select>
  )
}
