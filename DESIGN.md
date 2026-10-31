---
name: Notes workspace
description: A clear, file-first interface for reading and organizing personal notes.
colors:
  primary: "#326b58"
  background: "#fcfcfa"
  foreground: "#252a27"
  sidebar: "#f0f2ee"
  selected: "#dfe9df"
  muted-text: "#626b64"
  border: "#e1e5df"
  dark-background: "#1b201e"
  dark-sidebar: "#171c19"
  dark-foreground: "#e7ece7"
  dark-primary: "#9ac8ad"
typography:
  headline:
    fontFamily: "IBM Plex Sans Variable, sans-serif"
    fontSize: "30px"
    fontWeight: 550
    lineHeight: 1.25
    letterSpacing: "-0.035em"
  title:
    fontFamily: "IBM Plex Sans Variable, sans-serif"
    fontSize: "23px"
    fontWeight: 550
    letterSpacing: "-0.025em"
  body:
    fontFamily: "IBM Plex Sans Variable, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  label:
    fontFamily: "IBM Plex Sans Variable, sans-serif"
    fontSize: "12px"
rounded:
  control: "7px"
  preview: "9px"
  panel: "12px"
spacing:
  tight: "8px"
  row: "16px"
  section: "36px"
components:
  navigation-selected:
    backgroundColor: "{colors.selected}"
    rounded: "{rounded.control}"
    height: "36px"
  reading-select:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    height: "42px"
    rounded: "{rounded.control}"
---

# Design System: Notes

## Overview

The interface is a practical file library. Navigation and settings use a stable sans-serif face, while the note itself honors the reader’s chosen typography. File rows, subtle dividers, and clearly selected controls carry the hierarchy.

## Colors

The default Ink palette uses muted green for selected navigation and primary actions. Neutral layers distinguish sidebar, content, and controls. Dark mode uses corresponding green-gray surfaces. Existing Sepia, Forest, Slate, Dusk, Midnight, and Abyss themes remain available through the existing semantic variables in styles.css.

## Typography

IBM Plex Sans Variable carries interface labels, dashboard headings, and settings. Workspace headings are 30px on desktop and 26px on phones; settings headings are 23px and 21px respectively. Interface rows use 13–14px, supporting labels 11–12px. Reading preferences control note body and heading families and 16px, 18px, or 21px body sizing.

## Layout

A 56px toolbar contains the sidebar toggle, breadcrumb, search, and actions in keyboard order. The sidebar remains resizable. The workspace is capped at 1100px with 56px horizontal padding, reduced to 28px below 1000px and 20px below 768px. Sections have 36px separation, reduced to 28px on phones.

Settings have a 208px category column and independently scrolling content. Below 640px, navigation becomes a horizontal row above the pane. Palette previews use four columns on desktop and three on phones.

## Elevation & Depth

Main surfaces are flat and divided with fine borders. Settings use the existing Radix dialog with a shadow of `0 24px 90px #0003`. Preserve existing focus trapping, Escape behavior, and close control.

## Shapes

Controls and navigation use 7px corners; palette options use 9px; the continue row and reading preview use 12px. File rows use separators rather than individual cards.

## Components

The toolbar search has a visible text label and platform-aware shortcut on desktop; phones show the search icon. Palette options show miniature page previews, a selected outline, and a check. Reading typeface uses a native select and a live prose preview. Settings categories are Appearance, Reading, and Library; changes save immediately. Empty searches provide a recovery hint.

Markdown and text notes on desktop browsers and the desktop app show a compact
read-aloud group below the heading. Use the existing small outline button for
Read aloud / Pause / Resume, a ghost Stop button during playback, and a native
speed select. Once started, the controls float at the bottom right through
preparation, playback, and pauses; stopping or finishing returns them to the note.
Errors stay inline. Controls wrap on narrow screens and stop audio when the note or reading mode changes. No word highlighting
is added. Speech comes from a separate offline service on this computer.

## Do's and Don'ts

- Do maintain the corresponding interface changes in both source trees.
- Do use semantic palette variables for hover, selection, focus, and text.
- Do keep interface typography independent from reading preferences.
- Do use Lucide icons and platform-aware shortcut hints.
- Do preserve reduced-motion behavior and narrow-screen scrolling.
- Don't replace real file content with invented dashboard data.
