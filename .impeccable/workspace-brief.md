# Workspace redesign

Mode: Operate for navigation and settings; Read for note content.
Targets: app/src and rust-app/src. Code-first app UI.

## Direction contract

THESIS: Make a file-based notes library easy to scan and return to. Replace the promotional dashboard heading and equal cards with a practical workspace and file rows.

OWN-WORLD: Green-gray navigation, off-white reading surface, muted green active states, IBM Plex Sans interface, fine neutral dividers. Reading fonts remain user-selectable.

STORY: Open the workspace, browse folders or sample notes, resume the last note, search from the visible toolbar, and tune appearance without losing reading preferences.

FIRST VIEWPORT: Full-width toolbar with breadcrumb at left and search/actions at right; persistent left navigation; a 1100px workspace with heading, optional continue row, file list, note links, and small footer. Settings use category navigation beside a scrollable pane, stacked on phones.

FORM: File-library workspace; seed: none (unavailable). Both context and concept-seed were attempted; the installed launcher could not run because its engine was absent and its cache directory was not writable. Guidance and review were applied directly.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Verification

Browser captures inspected at desktop and phone sizes, including settings and a real note. Interaction checks cover navigation, search, palette selection, saved reading preferences, category search, theme switching, and overflow from 320px to 1440px. No new raster assets were created. Native Tauri packaging and device testing are outside this interface verification.
