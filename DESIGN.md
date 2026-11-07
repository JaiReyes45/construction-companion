---
name: Construction Companion
description: A project notebook beside a pixel construction site.
colors:
  paper: "#F5F0E6"
  ink: "#24211D"
  orange: "#C35A21"
  action: "#B84E19"
  action-hover: "#9D4215"
  muted: "#635B50"
  surface: "#FFFDF7"
  boundary: "#D8CDBD"
  field-boundary: "#A99A86"
  white: "#FFFFFF"
typography:
  display:
    fontFamily: "Georgia, serif"
    fontSize: "clamp(28px, 3.5vw, 36px)"
    fontWeight: 500
    lineHeight: 1.15
  headline:
    fontFamily: "Georgia, serif"
    fontSize: "24px"
    fontWeight: 500
  title:
    fontFamily: "ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    lineHeight: 1.35
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "16px"
    lineHeight: 1.6
  label:
    fontSize: "14px"
    fontWeight: 650
rounded:
  field: "6px"
  control: "8px"
  panel: "12px"
spacing:
  tight: "8px"
  small: "12px"
  normal: "16px"
  panel: "24px"
  page: "32px"
  section: "48px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.white}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 18px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.field}"
    padding: "10px 12px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.panel}"
    padding: "24px"
---

# Design System: Construction Companion

## Overview

**Creative North Star: "The construction notebook"**

Retain the owner's warm paper, dark ink and construction-orange world. Clear forms and a readable notebook sit beside original pixel workers. The interface supports work; the small scene supplies character.

**Key Characteristics:**
- Warm, flat surfaces with restrained boundaries.
- Readable serif headings and ordinary sans-serif controls.
- Original CC0 pixel workers with evidence-driven local motion.

## Colors

Construction orange supplies accents and focus. The darker action fill supports white control text; the original accent measured below body-text contrast for that pairing. Paper, surface, ink and muted ink provide the notebook hierarchy. Values in the frontmatter are normative.

## Typography

Georgia supplies modest display and section headings. The system sans carries forms and task text. Body paragraphs stop at 70 characters; display headings use a tighter 18-character measure. Question headings use the title size and stronger weight. Small explanatory text is secondary, never the sole carrier of an action.

## Layout

The page container stops at 1360px with 32px padding. The desktop workspace uses a 1.6:1 site/engineer split and a 24px gap. At 850px it becomes one column with the engineer first. At 600px forms and detail sections stack, with 16px horizontal page padding. Section spacing is wider than spacing within a form.

## Elevation & Depth

No drop shadows. Tonal differences separate the scene, paper and engineer panel; fine boundaries divide logs and inputs.

## Shapes

Panels have gently curved 12px corners. Controls use 8px corners; fields use 6px. Canvas geometry stays crisp and nearest-neighbor pixel art stays unblurred.

## Components

Primary buttons use the dark action fill with white text. Secondary buttons and answer choices use paper or transparent surfaces with ink text. Controls retain 44px minimum height and visible orange focus outlines. Inputs have labels and a muted boundary.

The engineer question has a polite live announcement and keeps keyboard focus usable when controls are replaced. Notebook drafts survive background polling until saved or the session changes. Disconnection clears displayed project state.

The canvas is decorative; HTML carries every state and action. Local motion pauses when hidden, disconnected, manually paused or reduced motion is requested. Selected crew members do not imply executing agents.

## Do's and Don'ts

- Do retain the owner-approved paper, ink and construction-orange palette.
- Do keep questions, actions and real task evidence readable outside the canvas.
- Do preserve native permission authority and clear offline states.
- Don't invent completion percentages or running workers from a selection alone.
- Don't make motion necessary to understand the project.
