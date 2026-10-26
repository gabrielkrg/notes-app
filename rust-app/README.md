# Notes Rust

The Notes desktop app with a Rust backend and Tauri 2 shell. The existing React interface is retained to preserve its editing and reading features. Electron and the Node runtime are removed from the desktop app. Node is needed only to build the interface.

This is the only desktop implementation. The browser and Android app live in `../app`. The Electron desktop implementation has been removed. Existing notes open without conversion, but preferences from old Electron installs are not automatically migrated. Attach your existing notes folders in Settings.

## Run

Install [Rust](https://rustup.rs/), Node.js 22+, and the [Tauri system prerequisites](https://v2.tauri.app/start/prerequisites/). On Linux, this includes GTK 3 and WebKitGTK 4.1 development libraries. Rust 1.90 or newer is required by the locked dependency graph.

```sh
cd rust-app
npm ci
npm run dev
```

Use Settings to attach folders, or set `NOTES_RUST_ROOTS` to comma-separated absolute folder paths. `NOTES_RUST_CONFIG_DIR` overrides the settings directory for portable or isolated runs. If the repository has a `notes/` folder, it is used on the first development run.

The default data directories use the application identifier `dev.notes.rust`. GitHub tokens use the operating system credential store. If that store is unavailable, the token stays in memory and Settings reports that it was not persisted. Tokens are never written to JSON settings.

## Build

```sh
npm run build                    # platform packages
npm run build -- --no-bundle      # standalone release executable
```

The executable is `src-tauri/target/release/notes-rust` (`.exe` on Windows). Packages land in `src-tauri/target/release/bundle/`. Build and sign on the target platform. This folder currently targets desktop; the original app's Android project remains in `../app/android`.

## Behavior retained

| Function | Implementation |
| --- | --- |
| Nested folders, multiple roots, default root, frontmatter, dashboard | Existing UI; Rust root validation and directory traversal |
| Markdown/text/HTML/CSS/JS, visual and source editing, save, task toggles | Existing editors; Rust atomic file writes |
| New/untitled notes, new folders, rename and retitle, confirmed deletion | Rust vault commands |
| Search by title, label, path and literal body text | Rust cached lowercase text and trigram candidates; results verified by exact substring matching |
| Ctrl/Cmd+K, chord shortcuts, Ctrl/Cmd+F, split view, contents rail | Existing UI |
| Link graph, bookmarks, reading progress, highlights and annotation notes | Existing UI and local storage |
| Theme, fonts, appearance and pane widths | Existing UI and local storage |
| HTML scripts, linked CSS/JS/images, preview storage and fullscreen | Existing sandboxed preview; Rust image reads |
| GitHub repositories, branches, subfolders, token, sync and errors | Native HTTPS; eight blob workers, tree and blob caches, offline fallback |
| Open with, browser links, frameless window buttons and dragging | Rust native launch/window commands and Tauri bridge |

Local refresh reuses unchanged file contents. Saving updates search immediately. GitHub is checked at startup, after remote/token/root changes, and when the user refreshes/syncs; local saves reuse the current remote snapshot. External edits are picked up by Refresh, matching the original explicit-refresh workflow.

Search returns at most 30 file and 30 body matches, with immediate queries and stale-response cancellation. Queries preserve literal, case-insensitive substring semantics, including punctuation and partial words. Content search starts at two UTF-16 units. The original browser fallback remains available in `npm run dev:ui`, but native file access and Rust search require the desktop window.

Files stay restricted to attached roots. Traversal, symlink escapes, root-directory deletion, and unsupported file types are rejected. HTML notes run inside an opaque-origin `sandbox="allow-scripts"` iframe and cannot access the Rust bridge. Inline scripts are enabled in the asset CSP because working HTML notes and their preview bootstrap require them; this does not grant note frames filesystem permissions.

## Verify

Use **Ctrl+E** to switch between the sidebar and note content, and **Ctrl+/** to open the in-app shortcut guide. The [keyboard navigation guide](../README.md#keyboard-navigation) lists the shortcuts, including folder navigation, search, bookmarks, and editing.

```sh
npm test                         # existing UI/helper regression tests
npm run typecheck
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features
npm run bench:search             # ignored release benchmark
cargo fmt --manifest-path src-tauri/Cargo.toml --check
```

The native desktop smoke test uses Python's standard library, `tauri-driver`, and on Linux `WebKitWebDriver` plus a display. It creates temporary folders and never edits your notes:

```sh
cargo install tauri-driver --locked
npm run build -- --debug --no-bundle
python3 tests/desktop_smoke.py
# To test the production executable:
python3 tests/desktop_smoke.py --binary src-tauri/target/release/notes-rust
```

The smoke test exercises actual IPC, all five file types, save/search invalidation, note/folder CRUD, containment and delete confirmation, rendered Markdown, the search dialog, bookmarks, task saves, visual editing, find-in-note, graph links, and sandboxed HTML script execution. It passed against the Linux release executable, alongside 31 existing regression test files and 13 Rust unit tests.

## Performance evidence

An optimized synthetic benchmark on 5,000 notes / 22.5 MB measured:

| Operation | Median | 95th percentile |
| --- | ---: | ---: |
| Rare body query | 0.013 ms | 0.015 ms |
| Common body query | 0.41 ms | 0.80 ms |
| Missing query, three or more bytes | 0.0014 ms | 0.0019 ms |
| Unicode query | 1.39 ms | 1.62 ms |
| Missing two-character ASCII query | 8.39 ms | 8.83 ms |
| Index update after an existing-note save | 5.35 ms | 5.44 ms |

Initial index construction took about 453 ms. Adding, removing, or renaming files rebuilds the index; existing-note changes update only affected postings. Two-byte queries scan cached lowercase text. These timings exclude disk access, IPC, UI rendering and startup, and are not an end-to-end comparison with Electron. Run the benchmark on your own notes/hardware to assess those costs.

## Reconstruction evidence

The [REA skill](https://github.com/morluto/rea/blob/main/.agents/skills/reverse-engineer-anything/SKILL.md) was read for this migration. It directs complete source-repository analysis to normal repository tools, so no REA provider/server setup or binary decompilation was needed. Before removal, behavior was traced through the Electron main process, preload, and notes backend, plus `../app/src/App.tsx`, `content-core.ts`, the search component, and the corresponding filesystem, GitHub, editor and preview helpers. Their existing tests were copied alongside the UI. Native Rust tests independently cover the replacement backend; UI behavior is also checked through the desktop smoke test.

Linux is the validated native target in this workspace. Windows/macOS packaging, system app chooser behavior, credential-store persistence, live private GitHub access, and Android parity require verification on those environments. GitHub transport is covered with deterministic mocked responses and disk-cache tests.
