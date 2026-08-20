# HTML, CSS, and JS notes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Treat `.html`, `.css`, and `.js` as notes: live sandboxed HTML preview, highlighted CSS/JS source, desktop code editing, and create-from-app.

**Architecture:** Extend `isNoteFile` / `fileKind` so discovery already picks up the new files. `buildContent` titles and routes them. HTML preview rewrites sibling CSS/JS into the srcdoc (inline, not blob URLs — blob URLs cannot load in an iframe with `sandbox="allow-scripts"` and no `allow-same-origin`). Desktop `readAsset` supplies image data URLs. App view/edit branches on `fileKind`.

**Tech Stack:** Existing Vite + React + Electron app; `highlight.js`; Node test runner (`node --test`).

**Spec:** `docs/superpowers/specs/2026-08-20-html-css-js-notes-design.md`

## Global Constraints

- Extensions: `.html`, `.css`, `.js` only (not `.htm` / `.mjs`).
- iframe sandbox is `allow-scripts` only — never `allow-same-origin`, `allow-top-navigation`, or `allow-popups`.
- Linked CSS/JS are inlined into srcdoc (sandbox-safe equivalent of the spec’s blob rewrite).
- Images are not sidebar notes. Desktop may load them via `readAsset` (5 MiB, image extensions only). Browser does not bundle binaries.
- No YAML frontmatter on HTML/CSS/JS. Folders still create `index.md`.
- Do not duplicate the feature in `browser/`.
- Do not add Monaco/CodeMirror.
- Do not commit unless the user asks (existing uncommitted work on `main`).

---

### Task 1: File kinds and starters

**Files:**
- Modify: `app/src/lib/note-name.ts`
- Test: `app/src/lib/note-name.test.ts`

**Produces:** `NoteFileType`, `fileKind(file)`, `parseNoteFileType(value)`, `noteFileFromName` with `type`, `starterHtml` / `starterCss` / `starterJs` / `starterForType`, `isNoteFile` includes html/css/js.

- [ ] Write failing tests in `note-name.test.ts` for the new helpers
- [ ] Run `node --test src/lib/note-name.test.ts` from `app/` and confirm fail
- [ ] Implement helpers
- [ ] Re-run tests until pass

### Task 2: Content routes, titles, index.html, collisions

**Files:**
- Modify: `app/src/content-core.ts`
- Test: `app/src/content-core.test.ts`

**Consumes:** `fileKind` from note-name.

- [ ] Failing tests: routes, `index.html` landing, collision preference, HTML `<title>`/`<h1>`, CSS/JS ignore `---`, no graph edges from html/css/js
- [ ] Implement `routeFor` / `isIndexFile` / `buildPages` / `pageByRoute` / graph skip
- [ ] Tests pass

### Task 3: HTML preview rewriter

**Files:**
- Create: `app/src/lib/html-preview.ts`
- Test: `app/src/lib/html-preview.test.ts`

**Produces:** `HTML_PREVIEW_SANDBOX = 'allow-scripts'`, `rewriteHtmlPreview(fromFile, html, pages, loadAsset?)` inlining CSS/JS and rewriting image URLs via `loadAsset`.

- [ ] Failing tests for rewrite behavior
- [ ] Implement rewriter
- [ ] Tests pass

### Task 4: Image assets

**Files:**
- Create: `app/src/lib/note-asset.ts`
- Test: `app/src/lib/note-asset.test.ts`
- Modify: `app/src/lib/desktop.ts`, `app/desktop/notes.ts`, `app/desktop/preload.ts`, `app/desktop/main.ts`

- [ ] Failing tests for `readAssetAt`
- [ ] Implement + wire `readAsset` IPC
- [ ] Tests pass

### Task 5: Discovery and delete copy

**Files:**
- Modify: `app/src/lib/note-delete.ts`, `app/desktop/notes.ts`
- Test: `app/src/lib/notes-walk.test.ts`, `app/src/lib/github-notes.test.ts`, `app/src/lib/note-delete.test.ts`

- [ ] Walk/GitHub keep html/css/js, skip binaries
- [ ] Delete html files; update save/delete error copy

### Task 6: UI — preview, code editor, create, article

**Files:**
- Create: `app/src/components/html-preview.tsx`, `app/src/components/code-editor.tsx`
- Modify: `app/src/App.tsx`, `app/src/components/create-note-dialog.tsx`, `app/src/components/global-graph.tsx`, `app/src/components/settings-dialog.tsx`, `README.md`

- [ ] HtmlPreview iframe with sandbox + rewritten srcdoc
- [ ] CodeEditor highlighted view + writable textarea; `flush()`
- [ ] Article branches on `fileKind`; hide cues/highlights for non-markdown
- [ ] Create dialog type picker; `createNote({ type })`
- [ ] Settings + README copy
- [ ] `npm test` and `npm run typecheck` from `app/`
