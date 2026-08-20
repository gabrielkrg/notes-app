# HTML, CSS, and JS notes

Date: 2026-08-20

The notes desk already treats `.md` and `.txt` as notes: the browser is a reader, the desktop app can create, edit, and delete. This spec adds `.html`, `.css`, and `.js` on that same flow.

HTML is a live page when reading. CSS and JS are highlighted source. Desktop Edit swaps the view for a code editor, the same way markdown Edit swaps the rendered note for the markdown editor. The browser stays view-only.

## Goals

- Open `.html` / `.css` / `.js` files that live in attached notes folders (and GitHub remotes) from the sidebar.
- Render HTML as a sandboxed live page, including scripts and linked CSS/JS from the notes tree.
- Show CSS and JS as highlighted source. Desktop Edit makes that source writable.
- Create HTML, CSS, and JS from the New note dialog, alongside markdown.
- Leave markdown / `.txt` behavior unchanged.

## Non-goals

- `.htm`, `.mjs`, `.jsx`, `.ts`, or other web extensions.
- Monaco, CodeMirror, split preview, live-reload, or a mini-IDE.
- Images, fonts, or other binaries in the sidebar.
- Bundling binary assets into the browser reader.
- ES modules, `fetch()` of sibling files, import maps, or a custom Electron protocol.
- Wiki-graph edges from HTML / CSS / JS.
- Highlights, cues, or annotations on HTML / CSS / JS.
- YAML frontmatter on HTML / CSS / JS.
- Changing folder create: new folders still get `index.md`.

## File kinds

`isNoteFile` accepts `.md`, `.txt`, `.html`, `.css`, and `.js` (case-insensitive). Discovery (`notes-walk`, GitHub remotes, the Vite notes plugin) keeps using that helper, so those files show up in the sidebar like any other note.

A second helper, `fileKind(file)`, chooses the view:

| Kind | Extensions | Read (all surfaces) | Desktop Edit |
| --- | --- | --- | --- |
| `markdown` | `.md`, `.txt` | Existing `MarkdownView` | Existing `NoteEditor` (visual + source) |
| `html` | `.html` | Sandboxed live preview | Code editor |
| `css` | `.css` | Highlighted source, read-only | Same editor, writable |
| `js` | `.js` | Highlighted source, read-only | Same editor, writable |

Routes still drop the extension (`php/widget.html` → `php/widget`), matching markdown. `index.html` is a folder landing page, same as `index.md` / `index.txt`. `index.css` and `index.js` are ordinary files, not landings.

If two files collapse to the same route, `pageByRoute` prefers `.md`, then `.txt`, then `.html`, then `.css`, then `.js`. The sidebar still lists every file. If both `index.md` and `index.html` exist, `index.md` is the folder landing.

Titles:

- Markdown / txt: existing frontmatter / `#` heading / filename.
- HTML: `<title>`, else first `<h1>`, else filename. Do not parse YAML.
- CSS / JS: filename label (slug → title case), no frontmatter.

`buildPages` still runs `parseFrontmatter` on every raw file. For HTML / CSS / JS, ignore the parsed data and treat the whole file as `body` so a `---` in a stylesheet or script cannot steal the content.

## View and edit

`Article` in `App.tsx` branches on `fileKind(page.file)` instead of always rendering markdown.

- **HTML, not editing:** `HtmlPreview`. No cue strip, no “select a phrase to highlight”, no annotator.
- **CSS / JS, not editing:** `CodeView` (highlighted, read-only, monospace). Same chrome rules: no cues, no highlights.
- **Desktop Edit** on HTML / CSS / JS: replace the view with `CodeEditor`. Same header actions as markdown: Cancel / Save. No markdown toolbar (bold, headings, lists).
- **Browser:** the same read views. No Edit button (already true for the whole app).
- GitHub-sourced HTML / CSS / JS stay read-only, including the live HTML preview.

Markdown keeps its current visual editor. Do not reuse `NoteEditor` for code files.

`CodeView` and `CodeEditor` can share one highlighted control with a `readOnly` flag. Highlight with the stack already used for markdown fences (`highlight.js` / `rehype-highlight`). A textarea plus highlight is enough; do not add an editor framework.

## HTML preview

`HtmlPreview` is an iframe. It is a mini-browser for that file, not HTML injected into the notes chrome.

Sandbox: `allow-scripts` only. Do **not** set `allow-same-origin`, `allow-top-navigation`, or `allow-popups`. The page cannot read the parent app. Scripts may use the network (the point of a live page). GitHub HTML runs in the same sandbox; it gets no extra privileges.

Load the iframe with `srcdoc` of a rewritten document. Relative URLs are resolved against the HTML file’s directory using the same path rules as `resolveMdHref` (virtual notes paths, no `..` escape above the vault).

Rewrite these:

- `<link rel="stylesheet" href>` when the target is a `.css` note
- `<script src>` when the target is a `.js` note
- `url(...)` inside those CSS notes when the target is another `.css` note or an allowed image
- `<img src>` / `<source src>` / `<poster>` when the target is an allowed image (desktop only; see below)

Turn matched CSS / JS into `blob:` URLs from the in-memory pages map. Unresolved relative links are left as-is (broken in the preview, not fatal). Absolute `http(s):`, `mailto:`, `data:`, and `#` hashes are left alone.

Images are not notes and do not appear in the sidebar.

- **Desktop:** a restricted `readAsset(file)` IPC. Path must resolve inside an attached notes root. Allowed extensions: `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.ico`. Reject anything else. Cap at 5 MiB. Return a data URL for the preview rewriter.
- **Browser:** do not bundle binaries. Relative images in the preview will not load unless they are already `http(s):` or `data:`. Linked CSS / JS from the notes map still rewrite.

Out of scope for this preview: `import` / `type="module"` sibling files, `fetch()` of notes paths, `@font-face` files, and a custom protocol. Those can come later if the rewrite model is not enough.

Broken HTML still renders. Missing CSS / JS does not block the page. Script errors stay in the iframe.

## Create, save, delete

New note (not new folder) gains a type control: Markdown, HTML, CSS, JavaScript. Default remains Markdown. Folders still create `index.md`.

`noteFileFromName` takes an optional `ext` / `fileKind` and writes `name.html` (etc.) instead of always `.md`.

Starters (title from the dialog name):

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Title</title>
  </head>
  <body>
    <h1>Title</h1>
  </body>
</html>
```

```css
/* Title */
```

```js
// Title
```

Save and delete keep using `isNoteFile`. Update the error copy from “Only markdown and text files…” to cover HTML, CSS, and JS.

`createNote` IPC / `CreateNoteInput` gains an optional `type` (`markdown` | `html` | `css` | `js`). Omit or `markdown` preserves current behavior.

Settings and README copy that say “`.md` and `.txt`” should mention `.html`, `.css`, and `.js`.

## Data flow

1. Walk / GitHub / Vite load any `isNoteFile` into the raw pages map (text).
2. `buildContent` builds `NotePage` records, with kind-specific title / body rules above.
3. Opening a route uses `pageByRoute` (with the collision preference).
4. Read path: markdown → `MarkdownView`; html → rewrite + iframe; css/js → `CodeView`.
5. Desktop Edit: markdown → `NoteEditor`; html/css/js → `CodeEditor`. Save writes the draft through existing `writeNote`.
6. HTML rewrite reads sibling CSS / JS from the pages map; desktop image URLs go through `readAsset`.

## Error handling

- Unknown create type: reject, do not write a file.
- `readAsset` outside a notes root, disallowed extension, missing file, or over 5 MiB: throw; the rewriter skips that URL.
- Save / delete of a non-note file: existing throw, with updated copy.
- Preview rewrite failures (bad HTML, missing sibling): show the document anyway.

## Testing

Extend existing unit tests rather than adding a new runner.

- `note-name`: `isNoteFile` for html/css/js; `fileKind`; `noteFileFromName` with type; starters.
- `content-core`: routes for `.html` / `.css` / `.js`; `index.html` landing; route collision preference; HTML title from `<title>` / `<h1>`; CSS/JS ignore `---` frontmatter; `pageByRoute` fallbacks include `index.html`.
- New rewriter tests: relative CSS/JS → blob; external URLs untouched; missing sibling left as-is; `url()` in CSS; no parent-app leak in the produced markup (no `allow-same-origin`).
- `notes-walk` / `github-notes`: html/css/js kept, binaries still skipped.
- `note-delete` / desktop save copy if those strings are asserted.
- Create-note type wiring if the desktop create helper is tested.

No iframe / Electron e2e for v1. `npm test` and `npm run typecheck` are the gate.

## Files likely to change

- `app/src/lib/note-name.ts` — extensions, kind, starters, create path
- `app/src/content-core.ts` — routes, index, titles, `pageByRoute`
- `app/src/lib/html-preview.ts` — URL rewrite (new, unit-tested)
- `app/src/components/html-preview.tsx` — iframe (new)
- `app/src/components/code-editor.tsx` — view + edit (new)
- `app/src/App.tsx` — branch view/edit; hide cues/highlights for non-markdown
- `app/src/components/create-note-dialog.tsx` — type picker
- `app/src/lib/desktop.ts`, `app/desktop/notes.ts`, `app/desktop/preload.ts`, `app/desktop/main.ts` — create type; `readAsset`
- `app/src/lib/note-delete.ts` — error copy
- Settings copy, `README.md`, and the tests next to the files above

`browser/` is not a workspace package; do not duplicate the feature there.
