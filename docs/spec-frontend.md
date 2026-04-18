# Geo-Insight: Frontend Specification

Supplementary spec. Implements the frontend half of `spec.md`: component tree, URL state schema, interaction patterns for the four coordinator walkthroughs, visual system, accessibility, keyboard map, and DoD. Depends on the frozen Pydantic schemas in `spec-data-pipeline.md` §8 — TypeScript types are generated from those models.

Reads after `spec.md` and `spec-data-pipeline.md`. Where this spec resolves a UX ambiguity, the resolution cites the base-spec section.

---

## 0. Reconciliation & UX principles

### 0.1 Reconciliation with base spec

Where this document's surfaces or interactions depart from `spec.md` §6, the amendment is listed here — same format as `spec-data-pipeline.md` §0. Each amendment names the base-spec section it changes, the reason, and the propagation target.

#### 0.1.a Scatter A quadrant labels (base spec §6 was mathematically inverted)

**Finding.** `spec.md` §6 reads: *"Bottom-right quadrant = acute + chronic (overlooked on both response measures)."* With X = `1 − coverage_ratio` (left 0 → right 1) and Y = `chronic_years` (bottom 0 → top 5), the acute+chronic corner is **top-right**, not bottom-right. Bottom-right is acute-only (no chronic history).

**Resolution.** `<ScatterA>` quadrant labels — already correct in §4.4 — are now:
- top-right: *Acute + chronic*
- top-left: *Chronic only*
- bottom-right: *Acute only*
- bottom-left: *Well-funded*

**Amends:** `spec.md` §6 (two-scatter paragraph on Scatter A). Base spec is updated directly in this same pass so readers don't have to mentally apply the patch.

#### 0.1.b URL parameter space extended beyond base spec §6

**Finding.** `spec.md` §6 enumerates the URL state minimum — *"cohort chips, mode, sort column + direction, active scatter, custom weights, analysis year, filter selections"*. This spec adds three params the base didn't list:

- `focus=<ISO3>` — pins the briefing to a country; enables deep links into a specific row's briefing note.
- `detail=<clusters|trend|population>` — pre-opens the per-country detail sheet on a specific tab, so a shared URL can land the reader directly inside a cluster drill-down.
- `flags=<csv of QAFlag>` — filters the table to rows carrying at least one of the named flags, for sharing "show me all countries with `funding_imputed_zero`" views.

**Rationale.** The base spec's deep-linking claim was "a shared URL reproduces the ranking." These three params extend it to "a shared URL reproduces the *view*" — including which row is open, which detail tab is on, and which slice of flagged rows is visible. Without them, a reviewer opening the link would see the ranking but have to re-navigate to the part being discussed.

**Amends:** `spec.md` §6 (URL state paragraph). Full schema + precedence at §5.1 / §5.2 below.

#### 0.1.c Keyboard shortcut map is a new surface

**Finding.** `spec.md` §6 does not specify keyboard behavior. Introducing shortcuts is a coordinator-productivity win (all four walkthroughs are runnable keyboard-only) and an accessibility requirement (WCAG 2.1.1).

**Resolution.** Full shortcut map at §8. Single-letter shortcuts fire only when no text input is focused. `?` opens an overlay listing every shortcut.

**Amends:** `spec.md` §6 (no existing surface; this extends rather than overrides).

#### 0.1.d Scatter B axes (rolled-forward from pipeline spec §0.1)

**Finding.** `spec-data-pipeline.md` §0.1 replaced Scatter B's severity Y-axis because the HNO parquet has no severity column. Frontend spec §4.4 carries the result forward: X = `log10(pin)`, Y = `pin_share`, bubble = `unmet_need_usd`, no toggle.

**Amends:** `spec.md` §6 Scatter B paragraph. Base spec is updated directly (see §0.1.a's pass-through).

#### 0.1.e Footer component introduced

**Finding.** `spec.md` §3 implicitly references "data freshness" and "CSV export" and "URL state capture" without saying where those controls live. §7 of this spec names a `<footer>` landmark and §9.4 shortcuts `e` / `u` need a visible button surface. Keyboard-only actions without a mouse-reachable button fail Fitts's Law for anyone not shortcut-fluent.

**Resolution.** `<Footer />` component specified at §4.11 — data freshness, Export CSV, Copy share URL, link to calibration card.

**Amends:** `spec.md` §6 export + share paragraph (adds "rendered in the Footer component").

### 0.2 UX principles applied

The design surface is small (one page, one primary table, one secondary chart, a right-rail briefing). The risk is under-designing the information architecture and leaving the coordinator to reverse-engineer defensibility. Every decision below traces to one of these principles.

| Principle | Decision it drives |
|---|---|
| **Jakob's Law** (users expect your site to work like others) | Table semantics match data-grid conventions: sortable headers with indicator, sticky top row, row hover, click-to-open detail. Scope chips look like Linear/Gmail filter chips. |
| **Hick's Law** (decision time ∝ log of choices) | Mode toggle is a 3-option segmented control, not a dropdown. Custom weights panel is collapsed by default (advanced path), not visible upfront. |
| **Fitts's Law** (target size & distance) | Primary CTA (mode toggle) is 44px high min; sortable headers have a full-cell hit target; row hover region covers the entire row, not just the country cell. |
| **Miller's Law** (7 ± 2 chunks) | Default table shows 8 columns (see §4.2). Advanced columns (`custom_gap_score`, extra QA) reveal only when the advanced panel is open. |
| **Progressive disclosure** | Decomposition is *inline expansion*, not a modal — click a `gap_score` cell, the row grows to show the decomposition without navigation. |
| **Recognition over recall** | Every QA flag has a consistent color + icon + hover-tooltip explanation. Coordinators don't need to memorize what `donor_conc_2026_only` means. |
| **Error prevention** | Slider changes don't commit until `onChangeCommitted` (debounced 300ms) — no flicker-sort on every pixel drag. |
| **Peak-end rule** | Briefing note is the "peak" (the highest-value artifact per row). CSV export is the "end" — clearly labeled, one click, no modal. |
| **Aesthetic-usability effect** | Visual hierarchy invests in the table (the defensibility surface) and the briefing note (the decision artifact). Scatter is secondary — same card treatment but smaller visual weight. |
| **Deep linking (URL-as-state)** | Every viewing choice is in the URL. A shared link reproduces the ranking exactly. This is the core defensibility argument — users rely on it implicitly. |

---

## 1. Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript 5.5**
- **Tailwind CSS 4** + **shadcn/ui** (Radix primitives) for accessible components
- **Recharts** for Scatter A, Scatter B, trend chart
- **TanStack Table** for the country table (keyboard-first, sortable, accessible by default)
- **nuqs** for URL-state-as-source-of-truth (type-safe search params with React 19 `use()` integration)
- **Zod** at the API boundary for runtime validation of API responses
- **datamodel-code-generator** (backend build step) emits `pipeline/api/schemas.py` → `frontend/src/lib/api-types.ts`. No hand-written API types on the frontend.
- No global store. URL + React state only. The URL is the store.

```
frontend/
├── app/
│   ├── layout.tsx              # shell, fonts, theme
│   ├── page.tsx                # the one page — entry state
│   ├── api-docs/page.tsx       # optional: embedded API schema page for judges
│   └── globals.css
├── src/
│   ├── components/
│   │   ├── scope-banner/       # ScopeBanner + chips + exclusion count
│   │   ├── mode-toggle/
│   │   ├── country-table/      # Row, Cell, DecompositionRow, SortHeader
│   │   ├── scatter/            # ScatterA, ScatterB, shared primitives
│   │   ├── briefing-note/      # Lead, FactSheet, ScoreBox, Qualifiers, Grounding
│   │   ├── custom-weights/     # Advanced panel
│   │   ├── data-coverage/      # Excluded countries modal
│   │   ├── trend-view/         # Two-curve + 2026 inset
│   │   ├── cluster-drill/      # Per-country + cohort aggregate
│   │   ├── nl-query/           # Conditional — ships only if Day-1 checkpoint passes
│   │   └── ui/                 # shadcn primitives (button, dialog, slider, etc.)
│   ├── lib/
│   │   ├── api.ts              # typed fetch wrappers
│   │   ├── api-types.ts        # GENERATED — do not edit
│   │   ├── url-state.ts        # nuqs parser definitions + precedence rules
│   │   ├── formatters.ts       # usd(), ratio(), pct(), compactNum()
│   │   └── a11y.ts             # aria helpers, live-region utils
│   └── hooks/
│       ├── use-ranking.ts
│       ├── use-country-detail.ts
│       └── use-url-state.ts
└── tests/
    ├── components/             # Playwright component tests
    └── e2e/
        ├── walkthrough-1.spec.ts
        ├── walkthrough-2.spec.ts
        ├── walkthrough-3.spec.ts
        ├── walkthrough-4.spec.ts
        └── accessibility.spec.ts  # axe on every route
```

---

## 2. Design system

### 2.1 Typography

- **System font stack** (Inter fallback): `-apple-system, "Segoe UI", Inter, ...`. No webfont load — performance budget matters on a container demo.
- Body 14px / line-height 1.5; data cells 14px tabular-numerals (`font-variant-numeric: tabular-nums`) so columns align.
- Headers 12px uppercase semibold with 0.04em letter-spacing.
- Country names 14px semibold. Scores 14px tabular-numerals with monospace-like alignment.

### 2.2 Color tokens (light theme; dark theme parity required)

```
--bg              neutral-50 / neutral-950
--surface         white / neutral-900
--surface-2       neutral-100 / neutral-800   (card, table header)
--border          neutral-200 / neutral-800
--text            neutral-900 / neutral-100
--text-muted      neutral-500 / neutral-400
--accent          indigo-600 / indigo-400     (primary action)
--score-high      rose-600 / rose-400         (high gap_score, bad)
--score-mid       amber-500 / amber-400
--score-low       emerald-600 / emerald-400   (well-funded)
--flag-red        rose-500
--flag-amber      amber-500
--flag-neutral    slate-500
```

**No color-only encoding.** Every score color is paired with the numeric value. QA flags combine color + icon + text. Accessible contrast: all text pairs ≥ 4.5:1 on their background; axe-tested.

### 2.3 Spacing & layout

- 4/8/12/16/24/32/48 scale. No custom spacing values.
- Max content width 1440px. Below 1024px, the scatter collapses below the table (mobile is not a primary target — the brief is desktop, but it should not break).
- 12-column grid; table spans 8, right rail (briefing) spans 4. Under 1024px, briefing moves below.

### 2.4 Motion

- 150ms for state changes (sort, chip add/remove, slider commit).
- 250ms for layout shifts (row expansion, right-rail swap).
- `prefers-reduced-motion: reduce` disables all non-functional motion.

---

## 3. Information architecture

```
┌────────────────────────────────────────────────────────────────┐
│ Scope banner: PIN ≥ 1M · active HRP · year = 2025 · denom = PIN │  (sticky top)
│ [N] crises excluded — [review]                                  │
└────────────────────────────────────────────────────────────────┘
┌──── Mode toggle ──── Advanced: Custom weights [▸] ────────────┐
│ [ Acute | Structural | Combined ]                              │
└────────────────────────────────────────────────────────────────┘
┌─────────────── Country table ────────────────┐┌── Briefing ───┐
│ Sorted by: gap_score desc · [change]         ││ Lead para     │
│ ────────────────────────────────────────     ││ Fact sheet    │
│ [rows]                                       ││ Score box     │
│                                              ││ Qualifiers    │
└──────────────────────────────────────────────┘│ Grounding     │
┌─────────────── Scatter A / B (toggle) ──────┐ └───────────────┘
│                                              │
└──────────────────────────────────────────────┘
Footer: data freshness · CSV export · share URL
```

The entry state is this layout fully populated with defaults. No blank state. No "click to load." Server-rendered first paint with the default cohort (2025, PIN ≥ 1M, active HRP). Subsequent filters are client-side transitions via `useRouter().replace()` so the URL stays shareable.

---

## 4. Components

TypeScript prop types are generated from Pydantic (see §1). This spec shows logical props, not TS verbatim.

### 4.1 `<ScopeBanner />`

```
Props: { meta: RankingMeta, onChipChange: (next: Partial<Meta>) => void }
```

Renders left-to-right:

1. `PIN ≥ 1M` chip (click → popover with numeric input; values: 500k / 1M / 2M / custom)
2. `active HRP` chip (click → popover with toggle). **Tooltip, verbatim:** *"When on, cohort is restricted to HRP, Flash Appeal, and Regional Response Plan countries. When off, 'Other' and 'Unknown' plan types are included too. Countries with no appeal record are always excluded — see the [review] panel."* Chip toggles strictness-of-plan-type, not presence-of-plan.
3. `year = 2025` chip (click → popover; enum 2024 / 2025 / 2026 preliminary)
4. `denom = PIN` chip (MVP: read-only; shows "only PIN supported in MVP" tooltip)
5. `currency = USD (nominal)` (read-only)
6. Spacer
7. `[N] crises excluded — [review]` link (underlined; opens `<DataCoverageModal />`)

A11y: each chip is a `button` with `aria-haspopup="dialog"`; the popover is a Radix Popover with focus trap and Escape-to-close. Banner itself is `role="toolbar" aria-label="Cohort scope"`.

### 4.2 `<CountryTable />`

Columns, in visual order (default):

| # | Column | Header | Type | Sortable | Notes |
|---|---|---|---|---|---|
| 1 | `iso3`/`country` | Country | text | yes (alpha) | ISO3 flag icon + country name |
| 2 | `pin` | PIN | int | yes | tabular-num, compact ("14.7M") with raw on hover |
| 3 | `pin_share` | PIN share | % | yes | e.g. "31%" |
| 4 | `coverage_ratio` | Coverage | % | yes | uncapped; >100% rendered with `↑` indicator |
| 5 | `unmet_need_usd` | Unmet need | USD | yes | compact ("$1.2B") |
| 6 | `gap_score` | Gap score | 0–1 | **default sort desc** | color-swatch bar behind number (0 → 1 scale) |
| 7 | `chronic_years` | Chronic | int 0–5 | yes | dot-scale visualization (5 circles) |
| 8 | `hrp_status` | Plan | enum | yes | badge |
| — | `qa_flags` | Flags | badges | no | icon-only with tooltip; right-aligned |

When Advanced panel is open, column 9 is `custom_gap_score`. Never replaces `gap_score`.

**Row interaction states:**
- Hover: `--surface-2` background; cursor pointer on the country cell; right rail updates on hover after 200ms dwell (prevents flicker). Clicking the row *commits* the briefing to that country (URL `?focus=SDN`).
- Selected row (focused in briefing): 3px left border in `--accent`, `--surface-2` background.
- Clicking a `gap_score` cell: toggles an **inline expansion row** showing `(1 − 0.16) × 0.64 = 0.538` plus alternate-sort ranks. Expansion is the next `<tr>` with `colspan`, not a modal. Tab-navigable.
- Clicking a `custom_gap_score` cell: same inline pattern, linear form.
- Clicking a QA flag icon: opens a popover with definition + which countries share this flag.

**Sort affordances:**
- Column header shows arrow (↑/↓) on the active sort column only; hover shows the off-state arrow.
- Above the table: `Sorted by: Gap score · [change]` where `[change]` opens a column picker popover (all sortable columns listed).
- "Change" takes precedence over mode preset (base spec §6 precedence rule).
- `aria-sort` attribute set on the active header.

**Performance:**
- Table row count is ≤ ~30 in practice. No virtualization needed. Still, rows render as memoized components so sort doesn't re-render the whole table.

### 4.3 `<ModeToggle />`

Segmented 3-option control (Radix ToggleGroup, single-select, `aria-label="Analysis mode"`). Keyboard: Left/Right arrows move selection. Each option:

| Mode | Label | Tooltip (on hover + on focus) |
|---|---|---|
| `acute` | Acute | "Sort by acute funding gap. Scatter A emphasizes X-axis." |
| `structural` | Structural | "Sort by chronic-year count. Scatter A emphasizes Y-axis." |
| `combined` | Combined | "Default. Sort by composite gap score. Scatter A balanced." |

On change, URL `?mode=structural` is set and table re-sorts. If `?sort=` is also present, the explicit sort wins (the "Sorted by" header shows the explicit sort and a subtle line "Mode preset overridden — [reset]").

### 4.4 `<ScatterA />` and `<ScatterB />`

Both use Recharts `<ScatterChart>`. Shared primitives: axis labels always show units; gridlines light; tooltip shows country name + all plotted values.

**Scatter A — funding response**
- X: `1 − min(coverage_ratio, 1)` (0 = fully funded, 1 = zero funded)
- Y: `chronic_years` (0–5)
- Bubble radius: scales with `gap_score` (min 4px, max 16px)
- Quadrant labels (faint, diagonal): "Acute only" (bottom-right), "Chronic only" (top-left), "Acute + chronic" (top-right), "Well-funded" (bottom-left)
- **Hover vs click interaction:**
  - *Hover* on a point → transient highlight on the corresponding table row (and vice-versa). Pure client-side React state. **No URL write.** Leaves the user's shared view intact while they're exploring.
  - *Click* on a point (or row) → commits the selection: URL updates with `?focus=ISO3`, briefing note swaps to that country, the selected row gets the persistent left-border accent. A shared URL reproduces the committed focus, not the last hovered point.
  - Rationale: URL writes are expensive (history/state work) and noisy; hover over 20 points should not flood `useRouter().replace()` 20 times.

**Scatter B — humanitarian situation (per §0.1 of pipeline spec)**
- X: `log10(pin)` — axis label *"People in need (log scale)"*. Absolute-burden lens: how many people need assistance.
- Y: `pin_share` — axis label *"Share of population in need"*. Proportional-burden lens: what fraction of the country's people.
- Bubble radius: scales with `unmet_need_usd` (min 4px, max 16px).
- No X-axis toggle. One axes pair. Absolute-vs-proportional is the decision lens the scatter communicates; collapsing either dimension defeats the purpose.
- Quadrant labels (faint, diagonal):
  - **top-right:** *"Large AND proportionally severe"* (e.g. Sudan, Yemen class — worst humanitarian situation)
  - **top-left:** *"Small but proportionally crushed"* (small populations where a large share is affected)
  - **bottom-right:** *"Large with moderate proportional burden"* (big absolute numbers, smaller fraction)
  - **bottom-left:** *"Small and moderate"*
- Hovering a point highlights the corresponding table row (same two-way linking pattern as Scatter A).

**Rationale, in the footer caption under the chart:** *"What the on-the-ground situation looks like independent of funding response — absolute scale against proportional intensity. Severity is not in the MVP data; this view is built from PIN and population alone."*

**Scatter switcher:** segmented control above the chart, `"A: funding response | B: humanitarian situation"`. Default A. `?scatter=a|b` in URL.

**Rationale, in a footer caption under each scatter:** one italic sentence explaining what the scatter is *for*, so a judge skimming the page understands the decision lens without having to open help.

### 4.5 `<BriefingNote />`

Right-rail card, sticky below the top nav. Sections in visual order (matches base spec §6):

1. **Lead** — one paragraph, 14px, max 3 sentences. MVP: pure template per base spec §3 (LLM path is post-MVP). Text: *"In {country}, {pin:compact} people — {pin_share:percent} of the population — require humanitarian assistance in {hno_year}. {funding_gap_sentence} {chronic_sentence}"* where the two latter sentences are template-selected based on thresholds (e.g. coverage < 0.3 → "Only {coverage:percent} of the $\{requirements:compact\} appeal has been funded.").
2. **Fact sheet** — two-column table of `FactSheet` fields. Left: label, right: value. Icons on labels. **Specific label requirements:**
   - `donor_concentration` row is labeled **"Top donors by commitment (HHI)"** (never "Top donors" or "Donor concentration" alone — per `spec-data-pipeline.md` §0.7). Subtitle in muted text below the value: *"HHI over all pledged, committed, and paid contributions — 2026 only."* Row is hidden entirely when `donor_concentration` is null (i.e. not 2026).
   - `coverage_ratio` row labeled "Coverage"; shows raw % value with an `↑` suffix when > 100%.
   - `chronic_years` row labeled "Chronic underfunding"; rendered as N-of-5 dots plus the count.
3. **Score box** — `gap_score` decomposition (multiplicative form) + alternate-sort ranks. If `custom_gap_score` active, linear form also.
4. **Qualifiers** — bulleted list of per-country callouts (e.g. "Refugee-hosting burden not reflected in PIN"; "2024 HNO used — 2025 field missing"). Sourced from the row's QA flags + iso3-specific overrides in a small YAML lookup.
5. **Grounding** — one line per dataset cited, linked to the dataset README where applicable.

A11y: the whole card is a `<section aria-labelledby="briefing-heading">`. Section transitions announce via `aria-live="polite"` when the focused country changes.

### 4.6 `<CustomWeightsPanel />`

Collapsed by default. Header button: `Advanced: Custom weights [▸]`. When open:

- Panel header disclaimer, verbatim: **"Custom weights use a linear composite; the default score is multiplicative. Setting weights won't reproduce the default — they answer different questions."**
- Three sliders: `w_coverage`, `w_pin`, `w_chronic`. Each 0–100% integer steps, tabular-num readout.
- Normalization: changing one slider proportionally rescales the others to preserve Σ = 1. Algorithm: let `Δ = new_v − old_v`; distribute `−Δ` across the other two in proportion to their current values (if both are zero, distribute evenly). Rounded to integers with biggest-remainder resolution. Pure client-side; shown live.
- Debounced `onChangeCommitted` (300ms after drag end) commits to URL `?weights=coverage:0.3,pin:0.3,chronic:0.4` and re-fetches the ranking.
- Below sliders: a "reset to balanced (1/3 each)" button.
- Sort-by header text updates: `"Sorted by: Custom gap score · (coverage 30% · pin 30% · chronic 40%) · [change]"`.

A11y: each slider has visible label, value, and unit. Arrow keys step 1%, PgUp/PgDn step 10%, Home/End jump to 0/100. `aria-valuetext` reads as "coverage thirty percent".

### 4.7 `<DataCoverageModal />`

Opened from the scope banner's `[review]` link. Radix `<Dialog>` with focus trap, Escape close, backdrop click close. Two tabs:

- **Excluded** — table of excluded countries with reason + human-readable detail. Sortable.
- **In cohort — flagged** — countries that are ranked but carry one or more QA flags. Flag filter chips at the top.

Closing returns focus to the `[review]` link (Radix default).

### 4.8 `<TrendView />`

Opened from the briefing note "View full history" link per country. Full-width dialog (not modal — `<Sheet>` from shadcn/ui, slides up from bottom on desktop; full screen on mobile).

Two-curve chart:
- X: year (1999–2026)
- Lines: `requirements_usd` (solid) and `funding_usd` (dashed)
- Shaded region between lines = unmet need
- Markers on years contributing to `chronic_years` (small ✖ icon above the axis)

2026 inset (visible only when `?year=2026` is in scope): stacked horizontal bar showing `paid / pledged / commitment / unmet`. Disclaimer below: *"Transaction-level 2026 data is not directly comparable across years; pre-2026 shows only aggregate funding."*

### 4.9 `<ClusterDrilldown />`

Tab inside the per-country detail sheet. Two sub-views:

1. **This country** — cluster table sorted by unmet_need_usd desc. `coverage_flag=low` rows highlighted. Taxonomy chip in header: `globalCluster` / `cluster (fallback)`.
2. **Cohort-wide** — same columns but aggregated; `countries_count` column appended.

**Population-group panel** is a third tab — read-only PIN disaggregation (Adults / Children / IDPs / etc. — whatever HNO 2025 carries). Prominent callout at top: *"Funding breakdown by population group is not available in FTS. Coverage comparisons are cluster-level only."*

### 4.10 `<NLQueryBar />` — conditional, ships only if Day-1 checkpoint passes

Single-line input above the table. Calls `POST /api/nl-query` (reserved in `spec-data-pipeline.md` §7.7); contract typed from the generated `NLQueryResponse`. On submit:
1. Request goes to `POST /api/nl-query` with the current cohort filters attached.
2. Echo-back: chips render the `echo_back_chips` from the response (e.g. `cluster = Food Security (globalCluster)`, `coverage_ratio < 0.10`). `caveats` render as small muted text beneath the chips.
3. User confirms (Enter) or edits individual chips (click to remove; click spare chip icon to add).
4. Confirmed chips become the source of truth and URL state updates.

**Build-parallelization.** The component builds against a **local mock** of `POST /api/nl-query` (served from `frontend/src/mocks/nl-query.ts`, matching the reserved shape) so frontend work does not block on the backend decision. When the Day-1 checkpoint resolves:
- **Passes (≥3 of 4 example queries round-trip):** real endpoint replaces the mock. No frontend code change required beyond flipping the API base URL.
- **Fails (≤2 round-trip):** this component is replaced by `<StructuredFilterBar />` with dropdowns + numeric inputs for the same filters. The rest of the spec is unchanged; the generated `ParsedFilter` type is still the source of truth for chip shapes.

On 501/503 from the endpoint at runtime, fall back to `<StructuredFilterBar />` with a one-line notice: *"Natural-language query unavailable. Use structured filters."*

### 4.11 `<Footer />`

Persistent bottom-of-page landmark. `role="contentinfo"`. Three children plus a link row; no overflow behavior needed (layout always fits on one line at desktop widths).

```
Props: { meta: RankingMeta, calibrationCardHref: string }
```

**Layout, left to right:**

1. **Data freshness** — `"Data last refreshed {N} {unit} ago"` where `{N} {unit}` is computed from `meta.data_freshness` (pipeline spec §7 `RankingMeta.data_freshness`). Tooltip on hover shows the exact ISO 8601 timestamp + which Parquet files contributed. If the freshness is > 24 hours, the text is wrapped in an amber pill (matches §6.2 "Stale data" state).
2. **Spacer** (flex-grow).
3. **`[Export CSV]` button** — primary style. Click hits `GET /api/export.csv` with the current URL params and triggers a download. Keyboard shortcut `e` (§8) mirrors this button — both paths call the same handler. Disabled state during the export fetch; shows a small inline spinner inside the button while pending. `aria-label="Export current view as CSV (keyboard: E)"`.
4. **`[Copy share URL]` button** — secondary/outline style. Click copies `window.location.href` to the clipboard and triggers a toast (`role="status"`, 3s auto-dismiss): *"URL copied — share to reproduce this view."* Keyboard shortcut `u`. `aria-label="Copy current view URL to clipboard (keyboard: U)"`.
5. **`[Calibration card]` link** — inline text link to the Markdown artifact produced by `spec-evaluation.md` §5 (`outputs/calibration_card.md`, rendered on GitHub). Opens in a new tab (`target="_blank" rel="noopener noreferrer"`); tiny external-link icon after the text. `aria-label="Open calibration card (opens in new tab)"`.

**A11y:**
- Landmark: `<footer role="contentinfo">`. Counts toward the §7 landmark contract.
- Toast (after Copy URL): announced via `role="status" aria-live="polite"` so screen readers get the confirmation.
- Focus order: Export CSV → Copy URL → Calibration card → data-freshness timestamp (tooltip trigger, last because informational, not actionable).

**Performance:**
- `meta.data_freshness` is already in the initial server render; no additional fetch.
- CSV export fetch uses a hidden `<a>` with a blob URL; no full-page navigation.

**DoD surface:** the `e` and `u` keyboard paths in §9.4 are the *same handlers* as these buttons — a single source of truth prevents drift between shortcut and click behavior.

---

## 5. URL state — the source of truth

`spec.md` §6 names the URL as the canonical shareable state. This section gives the exhaustive schema and precedence.

### 5.1 Parameters

| Key | Type | Default | Notes |
|---|---|---|---|
| `year` | `2024 \| 2025 \| 2026` | `2025` | analysis_year |
| `pin_floor` | int | `1000000` | in raw USD; UI renders "1M", "2M" |
| `hrp` | `true \| false` | `true` | require_hrp |
| `mode` | `acute \| structural \| combined` | `combined` | preset sort + scatter emphasis |
| `sort` | column name | matches mode | explicit sort; **overrides** mode's preset sort |
| `dir` | `asc \| desc` | `desc` | sort direction |
| `scatter` | `a \| b` | `a` | active scatter |
| `weights` | `coverage:N,pin:N,chronic:N` | absent | if absent, advanced panel is collapsed |
| `focus` | ISO3 | `` (top row) | which country is in the briefing + highlighted |
| `detail` | `clusters \| trend \| population` | absent | if present, the corresponding sheet is open |
| `flags` | CSV of QAFlag values | absent | filter to rows carrying at least one of these flags |

### 5.2 Precedence rules

1. **Explicit `sort` wins over `mode` preset.** UI shows an "overridden" note.
2. **`weights` present ⇒ advanced panel open.** Closing the panel removes `weights`.
3. **`focus` targets a non-existent or excluded ISO3** ⇒ panel shows a notice "This country is not in the current cohort — [see in excluded list]".
4. **`year=2026` + `scatter=b`** ⇒ still works but shows the "preliminary 2026 HNO" banner in the scatter card header.
5. **Malformed values** ⇒ silently ignored; fall back to default. Never 500.

### 5.3 URL preservation

- Next.js `useRouter().replace(href, { scroll: false })` — history does not pile up on every slider pixel.
- URL updates are debounced in two tiers: 50ms for discrete actions (chip click, mode toggle), 300ms for continuous (slider drag).

---

## 6. Interaction patterns

### 6.1 Server/client boundary

- `app/page.tsx` is a Server Component. Reads searchParams, fetches `/api/ranking` server-side, streams HTML for first paint with fully populated table + scatter + briefing.
- Client components for interaction (slider, chip, sort). They use `nuqs` for URL state; URL changes refetch via SWR with the `use()` boundary.
- Skeleton fallbacks for every client fetch; no spinners. Skeleton has the same row count as the table will have (cached from server render).

### 6.2 Empty / loading / error states

| State | Treatment |
|---|---|
| Loading (first paint) | Server-rendered. No client skeleton needed. |
| Loading (URL change) | Table body fades to 50% opacity for 150ms; if fetch exceeds 400ms, skeleton rows replace (prevents layout thrash). Scatter shows a shimmer overlay. Briefing pins to previous content until new arrives (reduces jank on rapid row clicks). |
| Empty (cohort is empty) | Large centered card with icon, heading "No crises match this scope", body "Try relaxing the PIN floor or allowing non-HRP appeals." + primary button "Reset to defaults". |
| Error (API 5xx) | Inline banner above the table: "Couldn't load rankings. [Retry]". The scope banner remains interactive — they can change params and retry. |
| Stale data (data_freshness > 24h old) | Amber notice in the footer: "Data last refreshed N hours ago — underlying FTS/HNO snapshots are not live." |

### 6.3 Focus management

- First `Tab` from document start lands on the scope banner's first chip. Skip-link at top of body: `"Skip to country table"`.
- Opening a dialog traps focus; closing returns to the element that opened it.
- Inline row expansion: focus moves to the first interactive element inside the expansion (usually the "alternate rank" links).

---

## 7. Accessibility (WCAG 2.2 AA)

Non-negotiable. Every release passes `axe-core` on every route with zero violations.

- **Keyboard** — every surface operable without a mouse. See §8.
- **Screen reader** — semantic tables (`<table>`, `<thead>`, `<tbody>`; no `<div>` grids). Sort state via `aria-sort`. Live regions announce: sort changes, row count changes, focus-country changes.
- **Color** — never the only signal. Score bars include the numeric value; QA flags include an icon + abbreviation; chronic-year dots include the numeric count.
- **Motion** — `prefers-reduced-motion` suppresses non-functional animations.
- **Zoom** — layout survives 200% zoom without horizontal scroll on desktop widths (1024px+).
- **Focus indicators** — 2px `--accent` outline, 2px offset. Always visible; no `outline: none`.
- **Labels** — every form control has a visible label (not placeholder-only).
- **Landmarks** — `<header>` (scope banner + mode), `<main>` (table + scatter), `<aside>` (briefing), `<footer>` (export + freshness).

---

## 8. Keyboard map

Single-letter shortcuts trigger only when no input is focused (`document.activeElement` is body or a non-text element).

| Key | Action |
|---|---|
| `/` | Focus the NL query bar (or structured filter bar if NL is cut) |
| `j` / `k` | Next / previous table row (with focus; briefing updates after 200ms) |
| `Enter` on row | Open country detail (clusters tab) |
| `Space` on row | Toggle inline `gap_score` decomposition |
| `1` / `2` / `3` | Switch mode: Acute / Structural / Combined |
| `a` / `b` | Switch scatter |
| `w` | Toggle custom weights panel |
| `e` | Trigger CSV export |
| `u` | Copy current URL to clipboard (shows a toast "URL copied — share to reproduce this view") |
| `?` | Open the keyboard shortcut overlay |
| `Esc` | Close any open dialog / popover; if none, clear `focus` and scroll table to top |

Shortcuts appear in a `?` overlay (Radix Dialog); also listed in the footer on hover.

---

## 9. Walkthroughs (UI step lists)

Each walkthrough is an E2E Playwright test. 90-second timed rehearsal must pass.

### 9.1 "Highest PIN share, lowest funding"

1. Land on `/` (defaults: year=2025, PIN≥1M, HRP active, mode=combined).
2. Verify the top row is the country with the highest `gap_score`.
3. Click its `gap_score` cell → inline decomposition row appears.
4. Read: `(1 − 0.16) × 0.64 = 0.538 · #2 composite · #7 unmet_need · #1 pin_share · #3 chronic_years`.
5. Briefing note on the right shows the country's fact sheet.

### 9.2 "Consistently underfunded across years"

1. Click `Structural` in the mode toggle.
2. Table re-sorts by `chronic_years` desc.
3. Scatter A's Y-axis visually emphasizes (axis label bolds, Y grid intensifies).
4. Click the top row's `chronic_years` cell → popover with the year-by-year coverage history.
5. Click "View full history" in the briefing → `<TrendView>` opens.

### 9.3 "Acute food insecurity with <10% funding"

**Branch selection for Playwright.** NL-vs-structured-fallback paths are not both exercised in the same test. Each CI run picks one, determined by the environment variable `NL_QUERY_ENABLED`:
- `NL_QUERY_ENABLED=true` → run the NL path (steps A).
- `NL_QUERY_ENABLED=false` → run the structured-fallback path (steps B).
- Default if unset: read `GET /api/nl-query` health probe (optional HEAD) — if it responds 200, run A; if 501, run B. The value is also surfaced in the test report so which branch ran is recorded. This makes the Day-1 checkpoint outcome visible in CI output without editing tests.

**Steps A — NL path (when enabled):**

1. Focus the query bar with keyboard shortcut `/`. Type `"acute food insecurity with less than 10% funding"`. Press `Enter`.
2. Echo-back chips appear: `cluster = Food Security (globalCluster)`, `coverage_ratio < 0.10`. Any `caveats` from `NLQueryResponse` render muted beneath the chips.
3. Confirm (`Enter` on the confirm button, or second `Enter` on a focused chip).
4. Table filters to the matching subset.

**Steps B — Structured fallback (when NL not shipped or endpoint 501/503):**

1. Open `<StructuredFilterBar>`.
2. Pick `cluster = Food Security (globalCluster)`.
3. Set `coverage_ratio < 0.10`.
4. Table filters to the matching subset.

**Both paths converge at step 5:**

5. The filtered subset surfaces the **cluster taxonomy blind spot** for at least one country: a row carries the `cluster_taxonomy_mismatch` QA flag (amber). The flag means the requested globalCluster match was missing in the harmonized FTS taxonomy and the pipeline fell back to the raw `cluster` field for that row (see `spec-data-pipeline.md` §3.3).
6. Click the flagged row → the detail sheet opens on the **Clusters** tab (`?detail=clusters` appears in URL).
7. The cluster drill-down renders with the taxonomy chip in the panel header reading `Source: raw cluster (globalCluster unavailable)` — the blind spot is now a concrete visible artifact rather than a claim.
8. **Playwright assertion strategy (must not hard-code country):** the test discovers the first row whose `qa_flags` array contains `"cluster_taxonomy_mismatch"` and asserts steps 6 and 7 against that row. Country name is recorded in the test report but not asserted — the dataset on disk decides which country surfaces the flag. Haiti is the likely candidate at the time of writing but the test must survive dataset refreshes.
9. If **no row** in the filtered subset carries the flag: the test records that fact and passes a secondary path — the `<DataCoverageModal />` is opened via the scope banner's `[review]` link, and the test asserts that the cohort's excluded-countries table enumerates at least one of `{no_active_hrp, stale_hno, no_fts_appeal_record, no_population_baseline}` with a country named. The blind-spot narrative still lands; the surface is the coverage panel rather than an in-table flag.

### 9.4 "Regional coordinator weighting chronic neglect more heavily"

1. Click `Advanced: Custom weights`.
2. Drag `w_chronic` to 40%; `w_coverage` and `w_pin` rescale to 30% each.
3. Click `Structural` mode toggle.
4. Click Scatter `B` toggle.
5. Verify the sort-by header reads: `"Sorted by: Custom gap score · (coverage 30% · pin 30% · chronic 40%) · [change]"`.
6. Press `e` → CSV downloads with current view.
7. Press `u` → URL copied to clipboard.
8. Paste URL in a new browser → identical view.

---

## 10. Performance budget

- First Contentful Paint < 1.5s on a fast 4G simulation.
- Largest Contentful Paint (country table first row) < 2.5s.
- Total JS < 250KB gzipped (Tailwind 4 is aggressive at tree-shaking; Recharts is the biggest offender — verify).
- Interaction to Next Paint (INP) < 200ms on sort / chip / mode toggle.
- Server-rendered first paint; client-side hydration is additive.

Measured with Lighthouse CI on every PR.

---

## 11. Tests

- **Unit / component** — Vitest + React Testing Library for `formatters`, `url-state`, `<ScopeBanner>`, `<CountryTable>` sort logic, `<CustomWeightsPanel>` normalization math.
- **E2E** — Playwright walkthroughs (§9) + a cross-browser run (Chromium, WebKit).
- **A11y** — `@axe-core/playwright` run after every walkthrough. Zero violations required.
- **Visual regression** — Playwright screenshots for:
  - Entry state (default `/`).
  - Each of the three modes (`?mode=acute`, `?mode=structural`, `?mode=combined`).
  - Advanced weights panel open.
  - Data-coverage modal open (both tabs: Excluded + In-cohort flagged).
  - **Scatter B active** (`?scatter=b`) — captures the new axes.
  - **Trend view open** for a country with multi-year history (`?focus=SDN&detail=trend`), including the 2026 inset when `?year=2026`.
  - **Cluster drill-down tabs** — all three tabs rendered separately (`?focus=SDN&detail=clusters`, Population groups tab active, Cohort-wide tab active).
  - **Briefing with decomposition expanded** — a row with its `gap_score` inline expansion open.
  - **Footer in both freshness states** — fresh (<24h) and stale (>24h, amber pill).
  - Each screenshot in both light and dark themes, at default viewport (1440×900) and mobile breakpoint (375×812).

---

## 12. Definition of done (frontend)

- [ ] All **11 top-level components** render with real API data from the default URL `/` (`<ScopeBanner>`, `<CountryTable>`, `<ModeToggle>`, `<ScatterA>`, `<ScatterB>`, `<BriefingNote>`, `<CustomWeightsPanel>`, `<DataCoverageModal>`, `<TrendView>`, `<ClusterDrilldown>`, `<Footer>`). When the NL-query path ships (§4.10 / walkthrough 9.3 Steps A), `<NLQueryBar>` makes it 12.
- [ ] Mode toggle changes sort + scatter emphasis; URL updates; state round-trips on refresh
- [ ] Scope banner chips open popovers; every chip change updates URL + table; `active HRP` chip tooltip renders the frozen wording from §4.1
- [ ] Custom weights panel: three sliders, Σ=1 preserved on every change, sort-by attribution line updates, URL round-trips
- [ ] Data coverage modal renders all four exclusion reasons and the in-cohort flagged list
- [ ] Scatter A renders: X = `1 − min(coverage, 1)`, Y = `chronic_years`, bubble = `gap_score`; quadrant labels match §0.1.a (top-right = "Acute + chronic")
- [ ] Scatter B renders: X = `log10(pin)` with axis label "People in need (log scale)", Y = `pin_share` with axis label "Share of population in need", bubble = `unmet_need_usd`; no X-axis toggle present
- [ ] Scatter A ↔ B toggle works; two-way highlight with table rows works in both views; hover does not write URL, click commits `?focus`
- [ ] Trend view opens per-country with two-curve chart + 2026 inset when year=2026
- [ ] Cluster drilldown: this-country + cohort-wide tabs both render correctly; taxonomy chip in header reflects the `cluster_taxonomy_mismatch` flag when fallback kicks in
- [ ] Population-group tab renders with "coverage by demographic not available" disclaimer visible
- [ ] Briefing note: template lead + fact sheet + score box + qualifiers + grounding for every row; donor row labeled "Top donors by commitment (HHI)"
- [ ] Footer renders data freshness, Export CSV button, Copy share URL button, calibration card link; `e` / `u` keyboard shortcuts invoke the same handlers as the buttons (single source of truth)
- [ ] CSV export downloads the current view with semicolon-joined qa_flags
- [ ] URL `/?mode=structural&weights=coverage:0.3,pin:0.3,chronic:0.4&focus=SDN&detail=clusters&scatter=b` renders the exact state (including `?focus`, `?detail`, `?flags` from §0.1.b)
- [ ] All four walkthroughs pass E2E in < 90s each on CI; walkthrough 9.3 picks NL vs structured branch per `NL_QUERY_ENABLED` env var and records which branch ran
- [ ] axe violations = 0 on every route
- [ ] Keyboard shortcut overlay (`?`) lists all shortcuts and all shortcuts fire
- [ ] Lighthouse: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95
- [ ] Visual-regression snapshots from §11 captured in CI; both light and dark themes; both viewports

---

*End of frontend spec. Depends on Pydantic schemas in `spec-data-pipeline.md` §8 and the visual/interaction contract in `spec.md` §6. No application code is written until the full spec set is approved.*
