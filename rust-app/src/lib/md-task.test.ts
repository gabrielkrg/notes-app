import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it } from 'node:test'
import ReactMarkdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'

import {
  rehypeTaskIndexes,
  remarkPartialTasks,
  toggleNthMdTask,
  toggleTaskInNote,
} from './md-task.ts'

function render(markdown: string) {
  return renderToStaticMarkup(
    createElement(
      ReactMarkdown,
      {
        remarkPlugins: [remarkGfm, remarkBreaks, remarkPartialTasks],
        rehypePlugins: [rehypeTaskIndexes],
      },
      markdown,
    ),
  )
}

describe('toggleNthMdTask', () => {
  it('checks the matching unchecked task', () => {
    const md = '- [ ] sql/qa.md\n- [x] php/qa.md\n'
    assert.equal(toggleNthMdTask(md, 0), '- [x] sql/qa.md\n- [x] php/qa.md\n')
  })

  it('unchecks the matching checked task', () => {
    const md = '- [ ] sql/qa.md\n- [x] php/qa.md\n'
    assert.equal(toggleNthMdTask(md, 1), '- [ ] sql/qa.md\n- [ ] php/qa.md\n')
  })

  it('checks a partial [~] task', () => {
    const md = '- [~] postgres/qa.md — only Transactions\n'
    assert.equal(toggleNthMdTask(md, 0), '- [x] postgres/qa.md — only Transactions\n')
  })

  it('unchecks an uppercase [X] marker to [ ]', () => {
    assert.equal(toggleNthMdTask('- [X] done\n', 0), '- [ ] done\n')
  })

  it('toggles starred, plus, and numbered tasks', () => {
    assert.equal(toggleNthMdTask('* [ ] a\n', 0), '* [x] a\n')
    assert.equal(toggleNthMdTask('+ [x] b\n', 0), '+ [ ] b\n')
    assert.equal(toggleNthMdTask('1. [ ] c\n', 0), '1. [x] c\n')
  })

  it('toggles a nested indented task without touching the parent', () => {
    const md = '- [x] parent\n  - [ ] child\n'
    assert.equal(toggleNthMdTask(md, 1), '- [x] parent\n  - [x] child\n')
  })

  it('ignores task-looking lines inside fenced code', () => {
    const md = `- [ ] real

\`\`\`
- [ ] fake
\`\`\`

- [ ] second
`
    assert.equal(
      toggleNthMdTask(md, 1),
      `- [ ] real

\`\`\`
- [ ] fake
\`\`\`

- [x] second
`,
    )
  })

  it('leaves markdown unchanged when the index is out of range', () => {
    const md = '- [ ] only\n'
    assert.equal(toggleNthMdTask(md, 4), md)
  })
})

describe('toggleTaskInNote', () => {
  it('toggles a task in the body and keeps the YAML wrapper', () => {
    const raw = `---
title: Roadmap
---

- [ ] sql/qa.md
- [x] php/qa.md
`
    assert.equal(
      toggleTaskInNote(raw, 0),
      `---
title: Roadmap
---

- [x] sql/qa.md
- [x] php/qa.md
`,
    )
  })
})

describe('remarkPartialTasks / rehypeTaskIndexes', () => {
  it('renders [~] items as partial task checkboxes instead of literal text', () => {
    const html = render('- [~] `postgres/qa.md` — only Transactions')
    assert.match(html, /task-list-item/)
    assert.match(html, /data-task-state="partial"/)
    assert.match(html, /postgres\/qa\.md/)
    assert.doesNotMatch(html, /\[~\]/)
  })

  it('numbers GFM and partial tasks in source order', () => {
    const html = render('- [x] done\n- [~] partial\n- [ ] todo\n')
    assert.match(html, /data-task-index="0"/)
    assert.match(html, /data-task-index="1"/)
    assert.match(html, /data-task-index="2"/)
    assert.match(html, /data-task-state="partial"/)
  })
})
