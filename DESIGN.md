# Design System, Locus

The visual source of truth. Read this before any UI change. Do not deviate
without explicit user approval. In QA, flag anything that does not match.

## Product Context

- **What this is:** A self-hosted, open-source web app that turns Google Maps
  business listings into enriched, sales-ready leads with verified emails.
- **Who it is for:** Operators who run lead extraction daily. Founders, SDRs,
  agency researchers. Technical enough to bring their own API keys.
- **Space:** B2B sales intelligence and lead generation. Peers: Clay, Apollo,
  Attio, Instantly.
- **Project type:** Data-dense web app (dashboard plus tables), plus a small
  marketing landing page and auth screens.

## Aesthetic Direction

- **Name:** Instrument
- **Decoration level:** minimal. No illustration, no gradients, no decorative
  color. The one ambient graphic allowed is a functional graticule grid on the
  live-extraction plot.
- **Mood:** Dark, high-contrast, dense, calm. Serious infrastructure you run all
  day. Linear and Vercel lineage. The data is the material. Nothing competes
  with it. "Premium intelligence": authoritative, not flashy.
- **Chosen over:** "Register" (warm-paper editorial) and "Quiet premium"
  (light Attio and Mercury calm), from a 3-way visual comparison.
- **Reference sites:** linear.app, vercel.com, attio.com (restraint only).
- **Supersedes:** commit `6a8249b` (Swiss-minimal warm neutrals plus evergreen
  accent). That direction is dropped.

## Typography

No serif anywhere. Two families, both already installed via `geist/font`. No
new font loading, no CDN.

- **Display, headings, UI, body:** Geist Sans (`var(--font-geist-sans)`).
  Weights: 400 body, 500 labels and buttons, 600 headings and emphasis. Never
  700 or above. Tight tracking on large text (`-0.01em` at 20px and up).
- **Data, numeric, code:** Geist Mono (`var(--font-geist-mono)`). Every number,
  count, rating, phone, email, timestamp, API key, ID, coordinate. Always
  `font-variant-numeric: tabular-nums`. This is the product's texture. Data
  looks like data, and the screen matches the CSV.
- **Micro-labels:** Geist Mono, 10.5px, `text-transform: uppercase`,
  `letter-spacing: 0.08em`, muted. Used for table headers, stat labels, nav
  group headings, running-head metadata.

### Scale (desktop, px)

| Role | Size / line-height | Family / weight |
|------|--------------------|-----------------|
| Page title (h1) | 22 / 1.2 | Geist 600, -0.01em |
| Section heading | 15 / 1.3 | Geist 600 |
| Body | 13.5 / 1.55 | Geist 400 |
| Table cell | 13 / 1.4 | Geist Mono 400 (name column Geist 500) |
| Big stat numeral | 28 / 1.1 | Geist Mono 500, tabular-nums |
| Micro-label | 10.5 / 1.3 | Geist Mono, uppercase, 0.08em |
| Button label | 12.5 / 1 | Geist 500 |

Judgment call: the comparison mock rendered big stat numbers in a serif (leaked
from a shared base style). Instrument has no serif. Stat numerals ship in Geist
Mono. Easy to revisit if wanted.

## Color

Approach: restrained. One accent, rationed. Dark is the default theme and the
design's home. Light is a faithful counterpart, not an afterthought.

### Dark (default)

| Token | Hex | Use |
|-------|-----|-----|
| `--background` | `#0E0F12` | App ground, sidebar |
| `--surface` | `#17181B` | Cards, panels, table body |
| `--surface-2` | `#1C1D21` | Inputs, raised rows, active nav bg base |
| `--foreground` | `#E9E8E4` | Primary text |
| `--foreground-strong` | `#F3F2EE` | Headings, key numerals |
| `--muted-foreground` | `#8F9096` | Labels, secondary text, icons at rest |
| `--border` | `#26272B` | Hairlines, dividers, card edges |
| `--border-strong` | `#33343A` | Input borders, hover edges |
| `--accent` | `#12B676` | Primary action, active nav mark, verified state, plot crosshair, selected-row bar, focus ring. Nothing else. |
| `--accent-foreground` | `#08150F` | Text or icon on a green fill |
| `--accent-muted` | `rgba(18,182,118,0.14)` | Active nav row background |
| `--positive` | `#12B676` | Email verified. Same green as the accent |
| `--destructive` | `#D95C4A` | Destructive text plus typed-confirm flows. Never a filled button at rest |
| `--ring` | `#12B676` | Keyboard focus outline (2px, 2px offset) |

### Light (counterpart)

| Token | Hex |
|-------|-----|
| `--background` | `#FBFBFA` |
| `--surface` | `#FFFFFF` |
| `--surface-2` | `#F4F4F2` |
| `--foreground` | `#1A1B1E` |
| `--foreground-strong` | `#0C0D0F` |
| `--muted-foreground` | `#6B6C71` |
| `--border` | `#E5E5E2` |
| `--border-strong` | `#D6D6D2` |
| `--accent` | `#0C7A50` (darkened for contrast on white) |
| `--accent-foreground` | `#FFFFFF` |
| `--accent-muted` | `rgba(12,122,80,0.10)` |
| `--positive` | `#0C7A50` |
| `--destructive` | `#B23A28` |
| `--ring` | `#0C7A50` |

Rules: accent is rationed to the five uses listed above. No gradients. No color
used decoratively. `--positive` and `--destructive` communicate state, never
structure.

## Spacing

- **Base unit:** 4px.
- **Density:** compact. This is a working tool, not a document.
- **Scale:** 2xs 2, xs 4, sm 8, md 12, lg 16, xl 24, 2xl 32, 3xl 48.
- Table row height 44px. Sidebar width 210px. Shell max content width 1400px.
  Content padding 24px on mobile, 32px on desktop.

## Layout

- **Approach:** grid-disciplined for the app. Hard-left alignment, nothing
  centered except empty states.
- **App shell:** fixed left rail (`--background`, 210px) with text labels plus
  16px 1.5-stroke icons. Active item: `--accent` text, `--accent-muted`
  background, 2px `--accent` bar on the left edge. Then a scrolling main column.
- **Running head:** every page opens with one row. Page title (Geist 22/600)
  hard-left, metadata (Geist Mono, uppercase, muted) hard-right, for example
  `142 RECORDS · UPDATED 14:22 · LONDON / RESTAURANTS`, over a 1px `--border`
  rule.
- **Command bar** (dashboard): a sentence, not a form.
  `Find ⟨ restaurants ⟩ in ⟨ London ⟩, up to ⟨ 60 ⟩ results.` Each slot is a
  real labeled input styled as an inline field with a dotted underline. One
  green Begin survey action, right-aligned.
- **Data table:** sits on `--surface`, no outer card wrapper on dark. Hairline
  (`--border`) between rows, no zebra striping. Sticky header, sticky name
  column. Header cells are micro-labels. Name column Geist 500, every other
  cell Geist Mono. Rating is the numeral `4.6`, never stars. Verified email is
  a filled 8px square in `--positive`, pending is a hollow square in `--muted`.
  Row hover: faint `--surface-2` wash. Selected row: 2px `--accent` left bar.
- **Border radius:** `--radius: 6px`. Buttons, inputs, cards 6px. Pills (filter
  tokens, status) 999px. No other radii.
- **Elevation:** hairlines do the work. Shadow is allowed only on true overlays
  (dropdown, popover, drawer): `0 8px 24px rgba(0,0,0,0.35)` on dark,
  `0 8px 24px rgba(0,0,0,0.10)` on light.

## Motion

- **Approach:** minimal-functional. Motion only when it aids comprehension.
- **Easing:** enter `cubic-bezier(0.2,0,0,1)`, exit `ease-in`, move
  `cubic-bezier(0.2,0,0,1)`.
- **Duration:** micro 80ms, short 140ms, medium 220ms, long 360ms.
- **Signature, the plot-in:** during a live extraction, a newly located
  business enters its row with a 140ms fade and rise plus a 2px `--accent`
  left-edge marker that decays over about 1s. It is the product working.
- **Row to detail:** expands in place (medium, `transform` plus `height`),
  pushing the table down. No modal, no route change.
- **Everything else:** 140ms opacity or transform on state change.
- **`prefers-reduced-motion`:** all of the above resolve instantly. The plot-in
  marker still appears, just without the animation.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-09-04 | Design system created, "Instrument" direction | `/design-consultation` with competitive research (Attio, Linear, Clay, Apollo) plus an independent direction pass. User chose Instrument from a 3-way visual comparison. |
| 2026-09-04 | Supersede commit `6a8249b` (Swiss-minimal plus evergreen) | New direction is dark-first, emerald-green-accented, denser. Old tokens dropped. |
| 2026-09-04 | Geist Sans plus Geist Mono, no new font deps | Already installed via `geist/font`. Geist is native to the Linear and Vercel aesthetic Instrument targets. |
| 2026-09-04 | No serif. Stat numerals in Geist Mono | The serif in the comparison mock was a shared-style leak, not the intent. |
