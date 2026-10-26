# Notes

A local desk for markdown, text, HTML, CSS, and JavaScript files. Notes stay on disk. Folders are menu groups.

In the browser, the app is a reader. The desktop app can also create, edit, and delete notes.

```bash
npm install
cp app/.env.example app/.env   # optional; defaults to this repo's notes/ folder
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

Desktop uses Rust, Tauri, and React (create / edit / attach folders). Install Rust and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/) first:

```bash
npm ci --prefix rust-app
npm run desktop
```

---

## What it does

- **Sidebar** — the file tree. Nested folders nest in the menu.
- **Search** — `Ctrl+K` / `⌘K`.
- **Graph** — wiki-style links between notes (`#/graph`).
- **Open file** — in the desktop app, pick an app from the system Open with dialog. In the browser, jump to the note in your editor (`cursor://file` by default).
- **Mark as read** — progress is stored in the browser.
- **Highlights** — select a phrase to highlight it or attach a note. Stored in `localStorage`, not in the file.
- **Theme** — light / dark.

Desktop only:

- Edit and save notes in the app.
- New note / new folder from the sidebar (right-click).
- Delete a note or folder.
- **Settings** — attach one or more folders of notes. Each folder is a top-level group.
- `Ctrl+K` then `Ctrl+O` — pick a folder to attach.

---

## Notes layout

```
notes/                 default root (or VITE_NOTES_ROOT)
  php/                 menu group
    index.md           landing file for that group (optional)
    arrays.md          file
    oop/               nested group
      late-static.md   file
  references/          another group
```

`index.md` (or `index.txt` / `index.html`) in a folder sets the group label and is the file you get when you click the group. It is not listed again as a child.

Files without a header still show up. The filename (or folder name) is enough.

To add a file: drop a `.md`, `.txt`, `.html`, `.css`, or `.js` in the folder you want it under, then refresh (or save, on desktop). To add a group: create a folder, optionally with an `index.md`.

HTML files open as a live preview (scripts and linked CSS/JS in the notes folder run in a sandbox). CSS and JS open as highlighted source. In the desktop app, Edit swaps that view for a code editor. The browser stays a reader.

---

## Optional header

```yaml
---
title: Arrays
nav: Arrays
order: 3
focus: Ordered hash maps, not C arrays
cue:
  - PHP arrays are ordered hash maps, not C arrays
  - isset / key lookup is O(1); in_array is O(n)
---
```

| Field | Used for |
|---|---|
| `title` | File heading |
| `nav` | Sidebar label (optional; falls back to title) |
| `order` | Sort inside the parent folder |
| `focus` | One-line summary on folder landing files / home cards |
| `cue` | Talking points in the right-hand rail (this file only) |

Wiki links in the body (`[Arrays](arrays.md)`) become edges on the graph.

---

## Configuration

Copy [`app/.env.example`](app/.env.example) to `app/.env`. Restart the dev server after changing it.

| Variable | What it does |
|---|---|
| `VITE_NOTES_ROOT` | Absolute path to a notes folder, or several paths separated by commas. Defaults to `<this-repo>/notes`. |
| `VITE_EDITOR_PROTOCOL` | URL scheme prepended for “Open file” in the browser. Default: `cursor://file`. The desktop app uses the system Open with dialog instead. |
| `VITE_STORAGE_PREFIX` | `localStorage` prefix (read marks, last file, theme, annotations). |
| `VITE_DEV_PORT` | Vite port. Default: `5173`. |
| `LAUNCH_EDITOR` | Editor for Vite’s error overlay. |

The desktop app remembers attached folders in its own settings file. On the first development run it uses the repo `notes/` folder if present; packaged installs can attach folders in Settings. The `VITE_*` configuration above applies to the browser build. See [desktop configuration](rust-app/README.md) for the Rust app.

---

## Build the desktop app

Install Rust, Node.js 22+, and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/), then build on the OS you want to ship. Packages land in `rust-app/src-tauri/target/release/bundle/`.

```bash
npm ci --prefix rust-app
npm run desktop:build
```

| OS | Command | Output |
|---|---|---|
| Linux | `npm run desktop:build:linux` | AppImage |
| Windows | `npm run desktop:build:win` | NSIS installer |
| macOS | `npm run desktop:build:mac` | Disk image |

`npm run desktop:build` creates the platform's default Tauri packages. `npm run desktop:pack` builds the executable without installers, under `rust-app/src-tauri/target/release/`.

Use Linux for AppImage, Windows for NSIS, and macOS for DMG builds.

Unsigned builds: macOS Gatekeeper and Windows SmartScreen will warn on first open until you sign the app.

---

## Scripts

| Command | |
|---|---|
| `npm run dev` | Web app |
| `npm run desktop` | Rust/Tauri desktop app with live reload |
| `npm test` | Node tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Web production build → `app/dist/` |
| `npm run desktop:pack` | Rust executable without installers |
| `npm run desktop:build` | Desktop packages → `rust-app/src-tauri/target/release/bundle/` |
| `npm run desktop:build:linux` | Linux AppImage |
| `npm run desktop:build:win` | Windows NSIS installer |
| `npm run desktop:build:mac` | macOS disk image |
| `npm run desktop:test` | Desktop React/helper tests |
| `npm run desktop:typecheck` | Desktop TypeScript check |

---

## Layout of this repo

```
app/                   browser and mobile app (React, Vite, Capacitor)
  mobile/              mobile API and build configuration
  android/             Android project
  dist/                web build
rust-app/              desktop app (React, Rust, Tauri)
  src/                 desktop React UI
  src-tauri/           Rust backend and desktop configuration
    target/release/    executable and bundled installers
notes/                 default notes tree
```
