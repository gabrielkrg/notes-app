import {
  FONT_SIZES,
  TYPEFACES,
  typefaceCustomProperties,
} from '@/lib/appearance.ts'
import { useAppearance } from '@/lib/appearance-provider.tsx'
import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export function FontSizePicker({ compact = false }: { compact?: boolean }) {
  const { fontSize, setFontSize } = useAppearance()

  return (
    <ToggleGroup
      type="single"
      size="sm"
      spacing={0}
      aria-label="Font size"
      value={fontSize}
      onValueChange={(value) => value && setFontSize(value as typeof fontSize)}
      className={cn('segmented', compact && 'w-full [&>*]:flex-1')}
    >
      {FONT_SIZES.map((option) => (
        <ToggleGroupItem key={option.id} value={option.id} aria-label={option.label} title={`${option.label} (${option.value})`}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
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
    <Select value={typeface} onValueChange={(value) => setTypeface(value as typeof typeface)}>
      <SelectTrigger aria-label="Reading typeface" className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent position="popper">
        {TYPEFACES.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            <span style={{ fontFamily: typefaceCustomProperties(option.id)['--font-sans'] }}>{option.faces}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
