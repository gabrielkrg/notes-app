const VOID_TAGS = new Set(['hr', 'br', 'img', 'input', 'meta', 'link'])

type HtmlText = { type: 'text'; text: string }
type HtmlElement = { type: 'element'; tag: string; attrs: Record<string, string>; children: HtmlNode[] }
type HtmlNode = HtmlText | HtmlElement
type ParsedBlock = { html: string; next: number }
type SerializedBlock = { type: string; text: string; tight?: boolean }

export function splitFrontmatter(raw: string): { prefix: string; body: string } {
  const text = String(raw)
  const match = text.match(/^(---\r?\n[\s\S]*?\r?\n---(?:\r?\n)*)([\s\S]*)$/)
  if (!match) return { prefix: '', body: text }
  return { prefix: match[1], body: match[2] }
}

export function joinNote(prefix: string, body: string): string {
  return `${prefix}${body}`
}

export function mdToHtml(body: string): string {
  const lines = String(body).replace(/\r\n/g, '\n').split('\n')
  const blocks: string[] = []
  let i = 0
  let prevBlank = true
  while (i < lines.length) {
    if (lines[i].trim() === '') {
      prevBlank = true
      i += 1
      continue
    }
    const parsed = parseBlock(lines, i, { tight: !prevBlank })
    blocks.push(parsed.html)
    i = parsed.next
    prevBlank = false
  }
  return blocks.join('')
}

export function htmlToMd(html: string): string {
  const root = parseHtml(String(html))
  const md = serializeBlocks(root.children)
  if (!md) return ''
  return md.endsWith('\n') ? md : `${md}\n`
}

function parseBlock(lines: string[], i: number, { tight = false }: { tight?: boolean } = {}): ParsedBlock {
  const line = lines[i]
  const next = lines[i + 1]

  if (/^(`{3,}|~{3,})/.test(line)) return parseFence(lines, i)
  if (isHr(line)) return { html: '<hr>', next: i + 1 }
  const heading = line.match(/^(#{1,3})\s+(.+?)\s*$/)
  if (heading) {
    const level = heading[1].length
    return {
      html: `<h${level}>${inlineToHtml(heading[2])}</h${level}>`,
      next: i + 1,
    }
  }
  if (line.startsWith('>')) return parseQuote(lines, i)
  if (/^[*+-] /.test(line)) return parseList(lines, i, 'ul', /^[*+-] (.*)$/, tight)
  if (/^\d+\. /.test(line)) return parseList(lines, i, 'ol', /^\d+\. (.*)$/, tight)
  if (line.includes('|') && next != null && isTableSeparator(next)) {
    return parseRawTable(lines, i)
  }

  return parseParagraph(lines, i)
}

function parseFence(lines: string[], i: number): ParsedBlock {
  const open = lines[i].match(/^(`{3,}|~{3,})(.*)$/)
  if (!open) return { html: '', next: i + 1 }
  const marker = open[1][0]
  const fenceLen = open[1].length
  const lang = open[2].trim()
  const content = []
  let j = i + 1
  while (j < lines.length && !isFenceClose(lines[j], marker, fenceLen)) {
    content.push(lines[j])
    j += 1
  }
  if (j < lines.length) j += 1
  const code = escapeHtml(content.join('\n'))
  return {
    html: `<pre data-md-code="${escapeHtml(lang)}"><code>${code}</code></pre>`,
    next: j,
  }
}

function isFenceClose(line: string, marker: string, fenceLen: number): boolean {
  const match = line.match(/^(`{3,}|~{3,})\s*$/)
  return Boolean(match && match[1][0] === marker && match[1].length >= fenceLen)
}

function parseQuote(lines: string[], i: number): ParsedBlock {
  const quoted = []
  let j = i
  while (j < lines.length && lines[j].startsWith('>')) {
    quoted.push(lines[j].replace(/^>\s?/, ''))
    j += 1
  }
  const inner = inlineToHtml(quoted.join('\n'))
  return { html: `<blockquote><p>${inner}</p></blockquote>`, next: j }
}

function parseList(lines: string[], i: number, tag: string, itemRe: RegExp, tight: boolean): ParsedBlock {
  const items: string[] = []
  let j = i
  while (j < lines.length) {
    const match = lines[j].match(itemRe)
    if (match) {
      items.push(`<li>${inlineToHtml(match[1])}`)
      j += 1
      const nested = parseNestedList(lines, j)
      if (nested) {
        items[items.length - 1] += nested.html
        j = nested.next
      }
      items[items.length - 1] += '</li>'
      continue
    }
    break
  }
  const attr = tight ? ' data-md-tight="true"' : ''
  return { html: `<${tag}${attr}>${items.join('')}</${tag}>`, next: j }
}

function parseNestedList(lines: string[], i: number): ParsedBlock | null {
  if (i >= lines.length) return null
  if (/^ {2,}[*+-] /.test(lines[i])) {
    return collectNested(lines, i, 'ul', /^ {2,}[*+-] (.*)$/)
  }
  if (/^ {2,}\d+\. /.test(lines[i])) {
    return collectNested(lines, i, 'ol', /^ {2,}\d+\. (.*)$/)
  }
  return null
}

function collectNested(lines: string[], i: number, tag: string, itemRe: RegExp): ParsedBlock | null {
  const items = []
  let j = i
  while (j < lines.length) {
    const match = lines[j].match(itemRe)
    if (!match) break
    items.push(`<li>${inlineToHtml(match[1])}</li>`)
    j += 1
  }
  if (!items.length) return null
  return { html: `<${tag}>${items.join('')}</${tag}>`, next: j }
}

function parseRawTable(lines: string[], i: number): ParsedBlock {
  const rows = []
  let j = i
  while (j < lines.length && lines[j].includes('|')) {
    rows.push(lines[j])
    j += 1
  }
  const raw = rows.join('\n')
  return {
    html: `<pre data-md-raw="true">${escapeHtml(raw)}</pre>`,
    next: j,
  }
}

function parseParagraph(lines: string[], i: number): ParsedBlock {
  const chunk = [lines[i]]
  let j = i + 1
  while (j < lines.length && lines[j].trim() !== '' && !isBlockStart(lines, j)) {
    chunk.push(lines[j])
    j += 1
  }
  return { html: `<p>${inlineToHtml(chunk.join('\n'))}</p>`, next: j }
}

function isBlockStart(lines: string[], i: number): boolean {
  const line = lines[i]
  const next = lines[i + 1]
  if (/^(`{3,}|~{3,})/.test(line)) return true
  if (isHr(line)) return true
  if (/^#{1,3}\s+/.test(line)) return true
  if (line.startsWith('>')) return true
  if (/^[*+-] /.test(line)) return true
  if (/^\d+\. /.test(line)) return true
  if (line.includes('|') && next != null && isTableSeparator(next)) return true
  return false
}

function isHr(line: string): boolean {
  return /^ {0,3}([-*_])(?: *\1){2,} *$/.test(line)
}

function isTableSeparator(line: string): boolean {
  const trimmed = line.trim()
  return trimmed.includes('|') && trimmed.includes('-') && /^[\s|:.-]+$/.test(trimmed)
}

function inlineToHtml(text: string): string {
  let i = 0
  let out = ''
  const src = String(text)
  while (i < src.length) {
    if (src[i] === '`') {
      const end = src.indexOf('`', i + 1)
      if (end !== -1) {
        out += `<code>${escapeHtml(src.slice(i + 1, end))}</code>`
        i = end + 1
        continue
      }
    }
    if (src.startsWith('**', i) || src.startsWith('__', i)) {
      const delim = src.slice(i, i + 2)
      const end = src.indexOf(delim, i + 2)
      if (end !== -1) {
        out += `<strong>${inlineToHtml(src.slice(i + 2, end))}</strong>`
        i = end + 2
        continue
      }
    }
    if (src[i] === '*' || src[i] === '_') {
      const delim = src[i]
      const end = src.indexOf(delim, i + 1)
      if (end > i + 1) {
        out += `<em>${inlineToHtml(src.slice(i + 1, end))}</em>`
        i = end + 1
        continue
      }
    }
    if (src[i] === '[') {
      const close = src.indexOf(']', i + 1)
      if (close !== -1 && src[close + 1] === '(') {
        const urlEnd = src.indexOf(')', close + 2)
        if (urlEnd !== -1) {
          const label = inlineToHtml(src.slice(i + 1, close))
          const href = escapeHtml(src.slice(close + 2, urlEnd))
          out += `<a href="${href}">${label}</a>`
          i = urlEnd + 1
          continue
        }
      }
    }
    if (src[i] === '\n') {
      out += '<br>'
      i += 1
      continue
    }
    out += escapeHtml(src[i])
    i += 1
  }
  return out
}

function serializeBlocks(nodes: HtmlNode[]): string {
  const blocks: SerializedBlock[] = []
  let pending: HtmlNode[] = []

  function flushInline() {
    const text = serializeInline(pending).trim()
    pending = []
    if (text) blocks.push({ type: 'p', text })
  }

  for (const node of nodes) {
    if (node.type === 'text') {
      if (node.text.trim()) pending.push(node)
      continue
    }
    if (isBlockTag(node.tag)) {
      flushInline()
      const text = serializeBlock(node)
      if (text !== '') {
        blocks.push({
          type: node.tag === 'div' ? 'p' : node.tag,
          text,
          tight: node.attrs?.['data-md-tight'] != null,
        })
      }
      continue
    }
    pending.push(node)
  }
  flushInline()
  return blocks
    .map((block, index) => {
      if (index === 0) return block.text
      const gap = block.tight ? '\n' : '\n\n'
      return `${gap}${block.text}`
    })
    .join('')
}

function isBlockTag(tag: string): boolean {
  return [
    'h1', 'h2', 'h3', 'p', 'div', 'ul', 'ol', 'pre', 'blockquote', 'hr', 'table',
  ].includes(tag)
}

function serializeBlock(node: HtmlElement): string {
  const { tag } = node
  if (tag === 'h1') return `# ${serializeInline(node.children)}`
  if (tag === 'h2') return `## ${serializeInline(node.children)}`
  if (tag === 'h3') return `### ${serializeInline(node.children)}`
  if (tag === 'p' || tag === 'div') return serializeInline(node.children).trim()
  if (tag === 'hr') return '---'
  if (tag === 'ul') return serializeList(node, '- ')
  if (tag === 'ol') return serializeList(node, (index) => `${index + 1}. `)
  if (tag === 'blockquote') {
    const inner = serializeBlocks(node.children)
    return inner
      .split('\n')
      .map((line) => (line === '' ? '>' : `> ${line}`))
      .join('\n')
      .replace(/>\s*$/, '')
      .replace(/\n$/, '')
  }
  if (tag === 'pre') {
    if (node.attrs['data-md-raw'] != null) {
      return textContent(node).replace(/\n$/, '')
    }
    const lang = node.attrs['data-md-code'] ?? ''
    const code = textContent(node).replace(/\n$/, '')
    return `\`\`\`${lang}\n${code}\n\`\`\``
  }
  return serializeInline(node.children).trim()
}

function serializeList(node: HtmlElement, marker: string | ((index: number) => string), indent = ''): string {
  const items = node.children.filter((child): child is HtmlElement => child.type === 'element' && child.tag === 'li')
  return items
    .map((item, index) => {
      const prefix = typeof marker === 'function' ? marker(index) : marker
      const nested = item.children.filter(
        (child): child is HtmlElement => child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol'),
      )
      const inline = item.children.filter(
        (child) => !(child.type === 'element' && (child.tag === 'ul' || child.tag === 'ol')),
      )
      const line = `${indent}${prefix}${serializeInline(inline).trim()}`
      if (!nested.length) return line
      const inner = nested
        .map((child) => serializeList(
          child,
          child.tag === 'ol' ? (n) => `${n + 1}. ` : '- ',
          `${indent}  `,
        ))
        .join('\n')
      return `${line}\n${inner}`
    })
    .join('\n')
}

function serializeInline(nodes: HtmlNode[]): string {
  let out = ''
  for (const node of nodes) {
    if (node.type === 'text') {
      out += node.text
      continue
    }
    if (node.tag === 'strong' || node.tag === 'b') {
      out += `**${serializeInline(node.children)}**`
      continue
    }
    if (node.tag === 'em' || node.tag === 'i') {
      out += `*${serializeInline(node.children)}*`
      continue
    }
    if (node.tag === 'code') {
      out += `\`${textContent(node)}\``
      continue
    }
    if (node.tag === 'a') {
      out += `[${serializeInline(node.children)}](${node.attrs.href || ''})`
      continue
    }
    if (node.tag === 'br') {
      out += '\n'
      continue
    }
    out += serializeInline(node.children)
  }
  return out
}

function textContent(node: HtmlNode): string {
  if (node.type === 'text') return node.text
  return (node.children || []).map(textContent).join('')
}

function parseHtml(html: string): HtmlElement {
  let i = 0
  const src = html

  function parseNodes(stopTag: string | null): HtmlNode[] {
    const nodes: HtmlNode[] = []
    while (i < src.length) {
      if (src.startsWith('</', i)) {
        const close = src.slice(i).match(/^<\/([a-zA-Z0-9-]+)\s*>/)
        if (!close) {
          nodes.push({ type: 'text', text: '<' })
          i += 1
          continue
        }
        i += close[0].length
        if (stopTag && close[1].toLowerCase() === stopTag) return nodes
        continue
      }
      if (src[i] === '<') {
        const open = src.slice(i).match(/^<([a-zA-Z0-9-]+)([^>]*?)\s*(\/?)>/)
        if (!open) {
          nodes.push({ type: 'text', text: '<' })
          i += 1
          continue
        }
        const tag = open[1].toLowerCase()
        const attrs = parseAttrs(open[2])
        const selfClosing = open[3] === '/' || VOID_TAGS.has(tag)
        i += open[0].length
        if (selfClosing) {
          nodes.push({ type: 'element', tag, attrs, children: [] })
          continue
        }
        const children = parseNodes(tag)
        nodes.push({ type: 'element', tag, attrs, children })
        continue
      }
      const next = src.indexOf('<', i)
      const end = next === -1 ? src.length : next
      const text = decodeEntities(src.slice(i, end))
      if (text) nodes.push({ type: 'text', text })
      i = end
    }
    return nodes
  }

  return { type: 'element', tag: 'root', attrs: {}, children: parseNodes(null) }
}

function parseAttrs(source: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let match: RegExpExecArray | null
  while ((match = re.exec(source))) {
    attrs[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '')
  }
  return attrs
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeEntities(text: string): string {
  return String(text)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
}
