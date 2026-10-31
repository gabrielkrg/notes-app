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

## Read aloud

Markdown and text notes have **Read aloud**, **Pause / Resume**, **Stop**, and a
speed selector below the heading. Playback streams as the local model generates
audio. While preparing, playing, or paused, the controls float at the bottom right
so they remain visible when scrolling. Changing files or entering the editor stops playback. Choose the speed
before starting; faster playback also raises pitch in this first version.
There is no word highlighting. HTML previews and source-code files do not show
the controls.

The browser and desktop interfaces use a small voice service on this computer.
It runs [Pocket TTS](https://github.com/kyutai-labs/pocket-tts) on the CPU with
the 18M English model and Alba voice. VoiceStudio does not need to be open.
The service binds only to `127.0.0.1:49325`; notes and audio stay on this machine.
Mobile devices are not supported by this local desktop service.

Set up once with Python 3.10–3.14 (Linux/macOS commands):

```bash
python3 -m venv .venv-reading
.venv-reading/bin/python -m pip install torch --index-url https://download.pytorch.org/whl/cpu
.venv-reading/bin/python -m pip install -r scripts/requirements-reading.txt
.venv-reading/bin/python scripts/reading_server.py --download
```

Setup requires internet to download dependencies, model weights, tokenizer, and
the preset voice. Files are cached in the ignored `.reading-models/` directory.
Upstream model access conditions apply; if a download reports an access error,
follow the Pocket TTS instructions printed by the service and retry setup.

Then start the voice service before reading:

```bash
.venv-reading/bin/python scripts/reading_server.py
```

Normal startup enables Hugging Face offline mode and disables its telemetry.
Keep this terminal running; Ctrl+C stops the service. There is no cloud speech
fallback. If the service is stopped, the controls show a retryable error.
Only one note can be synthesized at a time. The browser must be running on
localhost; a hosted HTTPS page may block access to local services.

Run the voice protocol checks without installing a model:

```bash
python3 -m unittest discover -s scripts -p 'test_reading_server.py'
```

---

## Keyboard navigation

Open the in-app guide with **Ctrl+/** or **Keyboard shortcuts** in the sidebar. It describes every app shortcut. On macOS, use **⌘** instead of **Ctrl**. Plain-letter shortcuts do not run while typing.

| Shortcut | Action |
|---|---|
| Ctrl+E | Switch focus between the sidebar menu and note content; reveal the sidebar if hidden |
| ↑ / ↓ | Move through visible sidebar items |
| → / ← | Expand or collapse folders; move to a child or parent |
| Home / End | Focus the first or last sidebar item |
| Enter | Open the focused note or activate a button |
| Ctrl+Enter | Open a focused sidebar note or folder in the split pane |
| Esc | Leave the sidebar, close a dialog, or cancel editing (with an unsaved-changes prompt) |
| Tab / Shift+Tab | Move forward or backward through controls and fields |
| Ctrl+B | Show/hide sidebar; bold in the visual editor |
| Alt+Home | Go to Dashboard |
| Ctrl+Shift+G | Switch between Graph and Dashboard |
| [ / ] | Previous / next note while reading |
| Ctrl+K | Open/close search; insert a link in the visual editor |
| / | Open search while reading |
| Ctrl+F | Open/close find in the current note |
| F3 / Shift+F3 | Next / previous find match |
| Ctrl+, | Open/close Settings |
| Ctrl+Shift+B | Open/close Bookmarks |
| Ctrl+D | Bookmark/unbookmark the current note |
| Ctrl+/ or ? | Open/close the shortcut guide; ? works outside text fields |
| F5 | Reload folders and sync remote notes |
| Ctrl+N | Create a desktop note in the default folder |
| E | Start editing; leave editing when focus is outside a text field |
| Ctrl+S | Save the current note |
| Ctrl+I | Italic in the visual editor |
| Ctrl+K, Ctrl+O | Attach a desktop notes folder; press the second shortcut within 500 ms |
| F | Toggle HTML fullscreen with focus outside the preview frame; Esc also exits |

Start with Ctrl+E, use the arrows to choose a note, press Enter, then Ctrl+E again to read and scroll its content. Dialogs keep focus inside their controls; close them with Esc before returning to the sidebar.

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
