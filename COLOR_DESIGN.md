# Color Design Specification

This document outlines the color system implemented in the CriticalWritingJp extension, following accessibility best practices.

## 1. Color Palette (Design Tokens)

The application uses a themable color system built on a set of accessible design tokens.

| Token Name        | Light/Warm Theme | Dark Theme | Description                               |
| ----------------- | ---------------- | ---------- | ----------------------------------------- |
| `background`      | `#FFFFFF`        | `#121212`  | Main application background.              |
| `surface`         | `#F7F7F7`        | `#1E1E1E`  | Background for cards, menus, etc.         |
| `divider`         | `#D9D9D9`        | `#333333`  | Separators and borders.                   |
| `text.primary`    | `#1A1A1A`        | `#F5F5F5`  | Primary text color for high emphasis.     |
| `text.secondary`  | `#4D4D4D`        | `#A8A8A8`  | Secondary text for medium emphasis.       |
| `primary`         | `#0072B2`        | `#0072B2`  | Main interactive elements (buttons, etc). |
| `secondary`       | `#009E73`        | `#009E73`  | Secondary interactive elements.           |
| `accent`          | `#E69F00`        | `#E69F00`  | For highlighting important information.   |
| `error`           | `#D55E00`        | `#D55E00`  | Error states, warnings, destructive actions. |
| `warning`         | `#F0E442`        | `#F0E442`  | Warning states that need attention.       |
| `info`            | `#56B4E9`        | `#56B4E9`  | Informational messages and highlights.    |
| `success`         | `#009E73`        | `#009E73`  | Success states and positive feedback.     |
| `focusOutline`    | `#000000`        | `#FFFFFF`  | Outline for keyboard-focused elements.    |

*Note: The Warm theme uses a different set of background (`#FDF6E3`) and text (`#657B83`) colors but shares the same primary/accent colors.*

## 2. UI Component Color Mapping

This section details how the color tokens are applied to the UI components built with the Atomize library.

### General UI
- **Main Background**: `background`
- **Panel/Card Backgrounds**: `surface`
- **Primary Text**: `text.primary` on `background` or `surface`.
- **Secondary Text / Labels**: `text.secondary`
- **Borders / Dividers**: `divider`

### Interactive Elements
- **Primary Buttons**:
  - Background: `primary`
  - Text: `onPrimary` (`#FFFFFF`)
- **Secondary Buttons / Links**:
  - Text: `link` (`#0072B2`)
  - Decoration: Underlined
- **Dropdowns / Menus**:
  - Background: `surface`
  - Text: `text.primary`
  - Selected Item Text: `primary`
- **Focus State**:
  - All interactive elements receive a `2px solid` outline using the `focusOutline` color on keyboard focus.

### Specific Panels
- **`StatisticsPanel` (Charts)**:
  - Chart segments will use the categorical chart palette: `["#0072B2", "#E69F00", "#009E73", ...]`
  - Chart labels will use `text.secondary`.
- **`RoiMapPanel` (Word Cloud)**:
  - Words with higher ROI scores will use brighter, more prominent colors from the categorical palette (e.g., `accent` - `#E69F00`).
  - Words with lower scores will use less prominent colors (e.g., `info` - `#56B4E9` or `text.secondary`).
- **`ResultsTable`**:
  - Header Background: `surface`
  - Header Text: `text.secondary`
  - Row Text: `text.primary`
  - Row Hover Background: `divider` (with low opacity)

### Editor Decorations
- **Paragraph Character Count**:
  - Text Color: `editorCodeLens.foreground` (A standard VS Code theme color to ensure it blends in).
  - Style: Italicized.
- **Over/Under Threshold Highlighting**:
  - These will use transparent versions of the `error` and `warning` colors, respectively.
- **Keyword Highlighting**:
  - Will use a transparent version of the `info` color.

This color system ensures a consistent, accessible, and themeable user interface across the extension.
