# Notes

A local desk for markdown (and `.txt`) files. Notes stay on disk. Folders are menu groups.

In the browser, the app is a reader. The desktop app can also create, edit, and delete notes.

```bash
npm install
cp app/.env.example app/.env   # optional; defaults to this repo's notes/ folder
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/).

Desktop (create / edit / attach folders):

```bash
npm run desktop
```

---

## What it does

- **Sidebar** — the file tree. Nested folders nest in the menu.
- **Search** — `Ctrl+K` / `⌘K`.
- **Graph** — wiki-style links between notes (`#/graph`).
- **Open file** — jump to the note in your editor (`cursor://file` by default).
- **Mark as read** — progress is stored in the browser.
- **Highlights** — select a phrase to highlight it or attach a note. Stored in `localStorage`, not in the file.
- **Theme** — light / dark.

Desktop only:

- Edit and save notes in the app.
- New note / new folder from the sidebar (right-click).
- Delete a note or folder.
- **Settings** — attach one or more folders of notes. With more than one, each folder is a top-level group.
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

`index.md` (or `index.txt`) in a folder sets the group label and is the file you get when you click the group. It is not listed again as a child.

Files without a header still show up. The filename (or folder name) is enough.

To add a file: drop a `.md` or `.txt` in the folder you want it under, then refresh (or save, on desktop). To add a group: create a folder, optionally with an `index.md`.

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
| `VITE_EDITOR_PROTOCOL` | URL scheme prepended for “Open file”. Default: `cursor://file`. |
| `VITE_STORAGE_PREFIX` | `localStorage` prefix (read marks, last file, theme, annotations). |
| `VITE_DEV_PORT` | Vite port. Default: `5173`. |
| `LAUNCH_EDITOR` | Editor for Vite’s error overlay. |

The packaged desktop app ships with the repo `notes/` folder and remembers extra folders in its own settings file.

---

## Build the desktop app

Install once, then package on the OS you want to ship. Artifacts land in `app/release/`.

```bash
npm install
```

| OS | Command | Output |
|---|---|---|
| Linux | `npm run desktop:build:linux` | `Notes-0.1.0.AppImage` |
| Windows | `npm run desktop:build:win` | `Notes-0.1.0.exe` (NSIS installer) |
| macOS | `npm run desktop:build:mac` | `Notes-0.1.0.dmg` |

`npm run desktop:build` is the same as the Linux command.

A macOS `.dmg` has to be built on a Mac. A Windows installer can be built from Linux or Windows. Linux AppImage is built on Linux.

Unsigned builds: macOS Gatekeeper and Windows SmartScreen will warn on first open until you sign the app.

---

## Scripts

| Command | |
|---|---|
| `npm run dev` | Web app |
| `npm run desktop` | Electron app |
| `npm test` | Node tests |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | Web production build → `app/dist/` |
| `npm run desktop:build` | Linux AppImage → `app/release/` |
| `npm run desktop:build:linux` | Linux AppImage → `app/release/` |
| `npm run desktop:build:win` | Windows NSIS installer → `app/release/` |
| `npm run desktop:build:mac` | macOS disk image → `app/release/` |

---

## Layout of this repo

```
app/                   the app (UI, Electron, Vite, package.json)
  desktop/             Electron main / preload
  dist/                web build
  dist-electron/       Electron main build
  release/             packaged installers
notes/                 default notes tree
```
