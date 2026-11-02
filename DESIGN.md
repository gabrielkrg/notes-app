---
name: Notes workspace
description: A clear, file-first interface for reading and organizing personal notes.
colors:
  primary: "#1c1c1f"
  background: "#f9f9f9"
  card: "#ffffff"
  foreground: "#18181b"
  sidebar: "#eeeeef"
  muted-text: "#68686f"
  border: "#e5e5e8"
  dark-background: "#161618"
  dark-card: "#1c1c1f"
  dark-sidebar: "#0f0f11"
  dark-foreground: "#ececee"
  dark-primary: "#ececee"
typography:
  headline:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "0"
  title:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "17px"
    fontWeight: 650
    letterSpacing: "0"
  section:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "13.5px"
    fontWeight: 650
  body:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "13px"
    lineHeight: 1.45
  label:
    fontFamily: "JetBrains Mono Variable, monospace"
    fontSize: "11.5px"
    fontWeight: 550
rounded:
  chip: "6px"
  control: "9px"
  input: "10px"
  card: "14px"
  panel: "14px"
  dialog: "16px"
spacing:
  shell-gap: "8px"
  tight: "8px"
  card: "14px"
  section: "26px"
components:
  navigation-selected:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.control}"
    height: "30px"
  library-card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.card}"
    padding: "14px"
  reading-select:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    height: "34px"
    rounded: "{rounded.input}"
---

# Design System: Notes

## Overview

The interface is a calm, dense file library. The toolbar and menu share one tinted ground, and the content floats on it as a rounded panel. Hierarchy comes from weight and color rather than size: most interface text sits between 11.5px and 13.5px, and only page titles reach 20px. The note itself honors the reader's chosen typography.

## Colors

There are exactly two themes, light and dark, both neutral gray and white with no hue. The color mode setting offers System, Light, and Dark. There are no other palettes.

- **Light:** the shell ground is `#eeeeef`, the content panel `#f9f9f9`, cards and popovers pure white, and text near-black `#18181b`.
- **Dark:** the shell ground is `#0f0f11`, the panel `#161618`, cards `#1c1c1f`, and text `#ececee`.

Primary actions are ink-on-paper: near-black buttons in light mode and near-white buttons in dark mode. The only chromatic color is the annotation highlight (and its derived link color) plus destructive red. The desktop title-bar overlay matches the shell ground. Scrollbars, selection, and the caret are themed from these tokens.

## Typography

JetBrains Mono Variable (self-hosted through Fontsource, exposed as `--font-ui`) carries all interface text: menu, toolbar, dashboard, dialogs, and settings. Letter-spacing is 0 throughout, and ligatures are off so file names and paths read literally. Weights do the work: 450 for rows, 550 for chips and labels, 600–650 for titles.

Sizes: page titles 20px (19px on phones), settings pane titles 17px, section headings 13.5px, body and rows 13px, and labels and counts 11–11.5px. Dialog, sheet, and card titles use the UI face, not the reading heading face.

Reading preferences control note body and heading families. "JetBrains Mono" is one of the reading options, alongside the serif and grotesk stacks. Body sizes are 16px, 18px, or 21px.

## Layout

A 48px toolbar on the shell ground holds the sidebar toggle, the breadcrumb (with the current page in semibold), and a 240×30px search field. The content panel sits 8px from the right and bottom edges, and from the left when the menu is collapsed, with 14px corners. On phones the panel goes edge to edge. Below the panel is a 34px strip of shell ground. Reload folders, Keyboard shortcuts, and Settings sit there at the bottom right as small 26px ghost buttons with 14px icons, outside the panel and mirroring the toolbar above it. The sidebar scrolls without a visible scrollbar. The workspace is capped at 1000px with 36px padding (24px below 1000px, 16px on phones) and 48px bottom padding. Sections are 26px apart.

The library is a 3-column card grid (2 below 1000px, 1 on phones). It shows 12 cards per page with numbered pagination, and a filter field sits in the section heading row when there are more than 6 items. Menu folder rows show their file count as a small chip.

Settings have a 208px category column and independently scrolling content. Below 640px, the navigation becomes a horizontal row above the pane.

## Elevation & Depth

There are two shadow tokens. `--raise` is a 1–2px offset for resting surfaces (panel, cards, search, selected rows). `--float` is a soft, offset shadow for hover lift, the dock, menus, and dialogs. Selected menu and settings rows are "raised chips": panel-colored with `--raise` and a 1px border ring. Hover changes only border color and shadow, never layout.

## Shapes

`--radius` is 0.7rem, so shadcn controls follow it (buttons ≈11px, dialogs ≈16px). Count chips use 6px or full pills, menu rows and small buttons 9px, inputs 10px, cards and the panel 14px, and the settings dialog 18px. Icon tiles are 30px with 9px corners.

## Components

The toolbar search has a visible text label and platform-aware shortcut on desktop; phones show the search icon. Palette options show miniature page previews, a selected outline, and a check. Reading typeface uses a native select and a live prose preview. Settings categories are Appearance, Reading, and Library; changes save immediately. Empty searches provide a recovery hint.

Markdown and text notes on desktop browsers and the desktop app show a compact
read-aloud group below the heading. Use the existing small outline button for
Read aloud / Pause / Resume, a ghost Stop button during playback, and a native
speed select. Once started, the controls float at the bottom right, stacked above the quick-actions dock, through
preparation, playback, and pauses; stopping or finishing returns them to the note.
Errors stay inline. Controls wrap on narrow screens and stop audio when the note or reading mode changes. No word highlighting
is added. Speech comes from a separate offline service on this computer.

## Outline

Markdown and HTML notes show an "On this page" outline beside the note on wide screens, and a collapsible bar on narrow ones.

- **Markdown:** built from the note's h2 and h3.
- **HTML:** built from h1–h3, reported by the sandboxed preview frame. The shallowest level present becomes the top of the outline. Clicking an entry scrolls the page to that heading, and the entry for the heading at the top is highlighted while you scroll.
- **Hiding it:** an × in the outline header, or the "On this page menu" switch in Settings > Reading. The choice is saved on the device. While it's hidden, an "Outline" button in the note toolbar brings it back.
- Notes with fewer than two headings show no outline.

## Do's and Don'ts

- Do maintain the corresponding interface changes in both source trees.
- Do use the semantic color variables for hover, selection, focus, and text.
- Don't add color palettes or tinted themes; keep the two neutral modes.
- Do keep interface typography independent from reading preferences.
- Do use Hugeicons (free stroke set, via `@/components/icons` or `HugeiconsIcon` in shadcn primitives) and platform-aware shortcut hints.
- Do use shadcn components for every control: Select (never a native `<select>`), ToggleGroup for segmented choices, RadioGroup, Input/InputGroup, Button, and Sonner toasts instead of `window.alert`.
- Do express hierarchy with weight and color before size; keep controls at 24–32px tall.
- Don't animate layout on hover (no sliding arrows or size shifts).
- Do preserve reduced-motion behavior and narrow-screen scrolling.
- Don't replace real file content with invented dashboard data.
