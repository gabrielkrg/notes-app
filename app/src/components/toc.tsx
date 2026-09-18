import { useEffect, useState, type RefObject } from 'react'
import { List } from 'lucide-react'

export type TocItem = { id: string; text: string; level: number }

function slugify(text: string, used: Set<string>) {
  const base = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'section'
  let id = base
  for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`
  used.add(id)
  return id
}

/** Reads headings straight from the rendered DOM, so it works for any renderer. */
export function useToc(root: RefObject<HTMLElement | null>, dep: unknown) {
  const [items, setItems] = useState<TocItem[]>([])
  const [active, setActive] = useState('')

  useEffect(() => {
    const el = root.current
    if (!el || !el.isConnected) {
      setItems([])
      return
    }
    const used = new Set<string>()
    const heads = Array.from(el.querySelectorAll('h2, h3')) as HTMLElement[]
    for (const head of heads) {
      if (!head.id) head.id = slugify(head.textContent || '', used)
      else used.add(head.id)
    }
    setItems(heads.map((head) => ({ id: head.id, text: head.textContent || '', level: head.tagName === 'H3' ? 3 : 2 })))
    setActive(heads[0]?.id || '')
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting)
        if (visible.length) setActive(visible[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px' },
    )
    for (const head of heads) observer.observe(head)
    return () => observer.disconnect()
  }, [root, dep])

  return { items, active }
}

function TocLinks({ items, active, onPick }: { items: TocItem[]; active: string; onPick?: () => void }) {
  return (
    <ul className="grid gap-1 text-sm">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            data-active={item.id === active || undefined}
            className={`block border-l py-1 text-muted-foreground transition-colors hover:text-foreground data-active:border-foreground data-active:text-foreground ${
              item.level === 3 ? 'pl-6' : 'pl-3'
            }`}
            onClick={(event) => {
              event.preventDefault()
              document.getElementById(item.id)?.scrollIntoView({ block: 'start', behavior: 'smooth' })
              onPick?.()
            }}
          >
            {item.text}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function Toc({ items, active }: { items: TocItem[]; active: string }) {
  if (items.length < 2) return null
  return (
    <nav aria-label="On this page" className="sticky top-8 hidden h-fit w-56 shrink-0 xl:block">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium">
        <List className="size-4" aria-hidden="true" />
        On this page
      </p>
      <TocLinks items={items} active={active} />
    </nav>
  )
}

export function TocMobile({ items, active }: { items: TocItem[]; active: string }) {
  if (items.length < 2) return null
  return (
    <details className="sticky top-0 z-20 -mx-6 border-b bg-background/95 px-6 py-2 backdrop-blur xl:hidden">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium">
        <List className="size-4" aria-hidden="true" />
        {items.find((item) => item.id === active)?.text || 'On this page'}
      </summary>
      <div className="max-h-64 overflow-auto py-2">
        <TocLinks
          items={items}
          active={active}
          onPick={() => document.querySelector<HTMLDetailsElement>('details[open].sticky')?.removeAttribute('open')}
        />
      </div>
    </details>
  )
}
