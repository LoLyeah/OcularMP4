# OcularMP4 Design System — Swiss Neo-Brutalist (Industrial Cyber)

> **Architectural Direction**: High-density, typography-first Swiss Neo-Brutalism engineered specifically for local media processing, FFmpeg conversions, and developer tools.

---

## 1. Core Palette: Acid Emerald & Industrial Graphite

| Token | Hex Value | Role & Usage |
| :--- | :--- | :--- |
| **`--surface`** | `#0a0e0c` | Primary dark background (Deep Charcoal Ink) |
| **`--surface-raised`** | `#131a17` | Structural panel & container background |
| **`--surface-paper`** | `#18221f` | Card highlight & dropdown background |
| **`--acid-emerald`** | `#00ff9d` | High-intensity primary accent (triggers, active state, live progress) |
| **`--acid-emerald-muted`** | `rgba(0, 255, 157, 0.12)` | Subtle glow & badge background |
| **`--amber-warning`** | `#ffaa00` | Warning thresholds, preflight flags, queue alerts |
| **`--crimson-alert`** | `#ff4757` | Error states & cancel actions |
| **`--text-primary`** | `#f3f6f4` | High-contrast crisp typography |
| **`--text-muted`** | `#8c9e96` | Monospace subheadings, metadata, disabled labels |
| **`--border-stark`** | `#223029` | 1px–2px crisp structural panel borders |

---

## 2. Typography Rules

### Display / Section Titles
- **Font Stack**: `"Instrument Serif", Georgia, "Times New Roman", serif`
- **Style**: High-contrast Serif headlines, uppercase, wide letter spacing where specified.
- **Purpose**: Creates an editorial publishing/cinematic feel for major workflow steps (`01. IMPORT`, `02. PRESET WORKSPACE`, `03. PARAMETERS`, `04. EXPORT STUDIO`).

### System / Monospace UI
- **Font Stack**: `"Space Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`
- **Style**: Uppercase, tracked letter-spacing (`tracking-[0.16em]`), high contrast.
- **Purpose**: Controls metadata labels, FFmpeg command strings, file sizes, container tags, bitrate values, and execution logs.

---

## 3. Structural Components

1. **`.brutal-card`**:
   - Sharp 2px radii border box with `#223029` stroke.
   - Hover states emphasize `#00ff9d` glow or border-color shift without soft shadows.

2. **`.terminal-block`**:
   - High-contrast CLI preview box displaying raw FFmpeg strings (`ffmpeg -i ...`).
   - Includes prompt glyph `❯` in Acid Emerald (`#00ff9d`) with instant copy capability.

3. **`.brutal-badge`**:
   - Monospace uppercase tag with subtle border (`border: 1px solid var(--border-stark)`).
   - High-visibility state indicators (`[PWA READY]`, `[LOCAL ENGINE]`, `[QUEUED]`, `[PROCESSING]`).

4. **`.brutal-btn-primary`**:
   - High-intensity `#00ff9d` button with black text (`#0a0e0c`), bold font weight, and sharp active transform feedback.
