---
# gstack: design-md-format=spec
name: zullumap
description: A riso print shop for maps — flat federal-blue ink on newsprint paper framing vivid community map prints.
colors:
  ink: "#244C91"
  ink-pressed: "#173B78"
  on-ink: "#F3F0E8"
  paper: "#E9E5DC"
  sheet: "#F3F0E8"
  text: "#244C91"
  text-muted: "#4F5A85"
  overprint: "#E74F8A"
  success: "#00666B"
  warning: "#8A5A00"
  error: "#B5242A"
  ramp-1: "#2499A6"
  ramp-2: "#F49AA8"
  ramp-3: "#E95E5A"
  ramp-4: "#E9B24F"
typography:
  display:
    fontFamily: Familjen Grotesk
    fontWeight: 600
    fontSize: clamp(2rem, 5vw, 3.5rem)
    letterSpacing: -0.01em
  title-label:
    fontFamily: Familjen Grotesk
    fontWeight: 600
    fontSize: 1.25rem
    lineHeight: 1.15
  body:
    fontFamily: Atkinson Hyperlegible Next
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: Atkinson Hyperlegible Next
    fontWeight: 600
    fontSize: 1rem
  mono:
    fontFamily: IBM Plex Mono
    fontSize: 0.875rem
    fontFeature: tnum
rounded:
  none: 0px
  sm: 2px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.none}"
    height: 48px
    plateColor: "{colors.overprint}"
    plateOffset: 4px
  button-primary-pressed:
    backgroundColor: "{colors.ink-pressed}"
    plateOffset: 0px
  title-label:
    backgroundColor: "{colors.sheet}"
    borderColor: "{colors.ink}"
    rounded: "{rounded.none}"
  bottom-sheet:
    backgroundColor: "{colors.sheet}"
    rounded: "{rounded.sm}"
  attribution-chip:
    textColor: "{colors.ink}"
---

# zullumap

## Overview

**Creative North Star:** a riso print shop for maps — the chrome is one quiet federal-blue ink on newsprint so the community's map prints carry all the color, because the one thing a first-time visitor should remember is "maps can be this beautiful".
**Product context:** open-source, agent-first 3D map templates (deck.gl + MapLibre) with remix; GIS analysts and #30DayMapChallenge mapmakers, mostly arriving from LinkedIn on phones.
**Mode per surface:** map page and trailer — Experience (the map owns the screen); gallery — Experience (trailer wall); template page — Read below a full-bleed map; remix panel and state messages — Operate.
**Key characteristics:** flat ink on paper (no shadows, cards, blur or glass); one blue ink plus a pink overprint plate; square corners; paper grain on chrome only; sentence case everywhere.

## Colors

**Strategy:** Restrained chrome (ink + paper) beside the maps' full ramp; color belongs to the maps.
**Light or dark:** light — phones in daylight and laptops at a desk; the maps are printed-paper looks. No dark theme in v1.
Ink signals text, the title label, links and the primary action; `overprint` is only ever the offset plate behind the primary button and the focus ring, never text (2.8:1). `ink-pressed` is the pressed/hover fill. Map ramp tokens are the default template ramp, not chrome colors. Success text uses the darker teal; the brand teal is for map fills and icons only.

## Typography

Familjen Grotesk (Google Fonts, OFL) is the display and title-label voice: a quirky ink-trap grotesk that reads slightly riso-bled, set in sentence case, never all caps or letter-spaced. Atkinson Hyperlegible Next (Google Fonts) is body and UI, chosen for legibility on phones in daylight; buttons use it at 16px semibold so they read as actions, not headings. IBM Plex Mono is only for numbers, units and commands (legends, the remix command), with tabular figures. Load all three from Google Fonts with `display=swap`. Scale steps differ by at least 1.25x; display never exceeds 3.5rem outside the gallery heading.

## Layout

Maps and the trailer wall bleed edge to edge. Template-page text sits in one left-aligned column (max 640px, 48px from the left edge on desktop, 16px gutters on phones). Bottom sheet: 16px side padding, 24px between legend and button. 4px base unit; chrome is comfortable, legends are tight (8px). Gallery tiles: 4px gaps, one per row on phones.

## Elevation & Depth

None. No shadows, blur or glass. Depth is the overprint plate: a flat pink duplicate offset 4px down-right. Overlays sit on ≥85%-opaque sheet color (accessibility rule D10).

## Shapes

Square: 0px on buttons, labels and tiles; 2px only on the bottom sheet's top corners. No pills.

## Components

- **Primary button** ("Make this map with your data"): full width in the sheet, 48px tall, ink fill, on-ink 16px semibold text; pink plate offset 4px. Pressed/hover: plate slides to 0px (the plates come into register) over 120ms and the fill darkens to ink-pressed. Focus-visible: 2px pink plate ring offset 2px. Disabled: 40% opacity, no plate.
- **Title label:** sheet fill, 1px ink border, 12px/16px padding, Familjen 20px sentence case, top-left.
- **Attribution chip:** "made with zullumap · remix" in 13px ink text directly on the map, no background shape (on maps it gets the ≥85% sheet backing required by D10).
- **Bottom sheet:** sheet fill with grain, grab bar 32×4px ink at 40%, legend row, then the primary button.
- **State messages:** one Atkinson sentence plus one action, set over the poster on an 85%-opaque sheet panel.

## Do's and Don'ts

- Do keep chrome to one ink (blue) plus the pink plate; let maps own color.
- Do use sentence case everywhere; titles never ALL CAPS, no dot separators.
- Do use the overprint plate only on the primary action and focus rings.
- Don't use rounded pills, drop shadows, glassmorphism or cards around map tiles.
- Don't put pink or brand teal on text.
- Don't center content blocks; left-align text columns.

## Motion

- **Approach:** intentional
- **Easing:** enter(ease-out) exit(ease-out) move(ease-in-out)
- **Duration:** micro 100ms (plate registration), short 200ms, medium 250ms (one ink pass), long 600ms (intro orbit easing)
- **The one authored moment:** ink-pass loading — over the poster the map prints one ink at a time (teal → pink → coral → mustard, ~250ms each) with "Printing the pink layer…"; gallery tiles wait as single-ink blue halftones until scrolled into view. Under `prefers-reduced-motion`, inks appear at once.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-11-20 | Initial design system created | Created by /design-consultation from the approved riso map mockup, the memorable thing "Maps can be this beautiful", and the approved template-page preview (5/5) |
| 2026-11-20 | Primary button uses the body font at 16px | User feedback: the display-size button read as a title and crowded the sheet |
