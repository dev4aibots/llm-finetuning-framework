# DESIGN.md — llm-finetuning-framework demo (Material Design 3, exact)

> Structure modeled on primer/primitives `DESIGN_TOKENS_GUIDE.md` (fetched live 2026-10-12).
> Primary source: official `material-components/material-web` (Apache-2.0, 11,332 stars, last commit 2026-10-07 "feat(labs): add snackbar component"), npm `@material/web@2.5.0` (verified live via registry). Token hex values below are COMPUTED from the repo's own generated artifacts (verified via downloaded npm tarball 2026-10-12): `package/tokens/versions/v0_192/_md-ref-palette.scss` (palette hexes) × `package/labs/gb/styles/color/md-color-tokens-full.css` (light/dark tone mapping), plus `md-motion-tokens-easing.css`, `md-shape-tokens.css`, `md-elevation-tokens.css`, `md-typography-tokens.css`, `md-space-tokens.css`. Not from memory.

## 1. Core rule

**Never use raw values (hex, px) in demo CSS. Only use `--md-sys-*` / `--md-ref-*` semantic tokens.**
Theming = overriding system token custom properties under `:root` (or `[data-theme]` scope), NOT forking component styles.

## 2. Logic matrix — color pairings (MUST)

| Surface token | Text token | Usage |
|---|---|---|
| `--md-sys-color-primary` | `--md-sys-color-on-primary` | Primary CTAs, active stepper step, selected tabs |
| `--md-sys-color-primary-container` | `--md-sys-color-on-primary-container` | Tonals, stage badges, highlighted rows |
| `--md-sys-color-secondary-container` | `--md-sys-color-on-secondary-container` | Chips, tags, completed-stage markers |
| `--md-sys-color-surface` / `surface-container-*` | `--md-sys-color-on-surface` | Page surfaces, cards, dialogs, tables |
| `--md-sys-color-surface-variant` | `--md-sys-color-on-surface-variant` | Metadata, captions, secondary text |
| `--md-sys-color-error` / `error-container` | `--md-sys-color-on-error` / `on-error-container` | Failed-run banners, validation errors |
| `--md-sys-color-inverse-surface` | `--md-sys-color-inverse-on-surface` | Snackbar background/text |
| `surface-container-*` | NEVER `on-surface` when `-variant` is semantically right; body copy → `on-surface`, metadata → `on-surface-variant` |

## 3. Color token sheet (M3 baseline, hex values verified)

### Light scheme
| Role | Hex | Role | Hex |
|---|---|---|---|
| `primary` | `#6750A4` | `surface` | `#FEF7FF` |
| `on-primary` | `#FFFFFF` | `on-surface` | `#1D1B20` |
| `primary-container` | `#EADDFF` | `on-surface-variant` | `#49454F` |
| `on-primary-container` | `#4F378B` | `surface-container-lowest` | `#FFFFFF` |
| `secondary` | `#625B71` | `surface-container-low` | `#F7F2FA` |
| `secondary-container` | `#E8DEF8` | `surface-container` | `#F3EDF7` |
| `on-secondary-container` | `#4A4458` | `surface-container-high` | `#ECE6F0` |
| `tertiary` | `#7D5260` | `surface-container-highest` | `#E6E0E9` |
| `tertiary-container` | `#FFD8E4` | `surface-dim` | `#DED8E1` |
| `error` | `#B3261E` | `surface-bright` | `#FEF7FF` |
| `error-container` | `#F9DEDC` | `outline` | `#79747E` |
| `on-error-container` | `#8C1D18` | `outline-variant` | `#CAC4D0` |
| `inverse-surface` | `#322F35` | `inverse-on-surface` | `#F5EFF7` |
| `inverse-primary` | `#D0BCFF` | `scrim` / `shadow` | `#000000` |

### Dark scheme
| Role | Hex | Role | Hex |
|---|---|---|---|
| `primary` | `#D0BCFF` | `surface` | `#141218` |
| `on-primary` | `#381E72` | `on-surface` | `#E6E1E5` |
| `primary-container` | `#4F378B` | `on-surface-variant` | `#CAC4D0` |
| `on-primary-container` | `#EADDFF` | `surface-container-lowest` | `#0F0D13` |
| `secondary` | `#CCC2DC` | `surface-container-low` | `#1D1B20` |
| `secondary-container` | `#4A4458` | `surface-container` | `#211F26` |
| `on-secondary-container` | `#E8DEF8` | `surface-container-high` | `#2B2930` |
| `tertiary` | `#EFB8C8` | `surface-container-highest` | `#36343B` |
| `tertiary-container` | `#633B48` | `surface-dim` | `#141218` |
| `error` | `#F2B8B5` | `surface-bright` | `#3B383E` |
| `error-container` | `#8C1D18` | `outline` | `#938F99` |
| `on-error-container` | `#F9DEDC` | `outline-variant` | `#49454F` |
| `inverse-surface` | `#E6E1E5` | `inverse-on-surface` | `#322F35` |
| `inverse-primary` | `#6750A4` | `scrim` / `shadow` | `#000000` |

### Type scale (font shorthand `--md-sys-typescale-<role>`, Roboto Flex / Roboto / system-ui)
| Role | Size/Line | Weight | Track | Use here |
|---|---|---|---|---|
| `display-lg` | 57px/64 | 400 | -0.25px | Hero number (e.g. "2.4M params") |
| `display-md` | 45/52 | 400 | 0 | — |
| `display-sm` | 36/44 | 400 | 0 | — |
| `headline-lg` | 32/40 | 400 | 0 | Screen titles |
| `headline-md` | 28/36 | 400 | 0 | — |
| `headline-sm` | 24/32 | 400 | 0 | Section headers |
| `title-lg` | 22/28 | 400 | 0 | Dialog titles, card titles |
| `title-md` | 16/24 | 500 | +0.15px | Table headers, list rows |
| `title-sm` | 14/20 | 500 | +0.1px | — |
| `label-lg` | 14/20 | 500 | +0.1px | Buttons |
| `label-md` | 12/16 | 500 | +0.5px | Chips, table column heads |
| `label-sm` | 11/16 | 500 | +0.5px | Overlines, badges |
| `body-lg` | 16/24 | 400 | +0.5px | Main copy |
| `body-md` | 14/20 | 400 | +0.25px | Default text |
| `body-sm` | 12/16 | 400 | +0.4px | Helper text, captions |

### Shape scale (`--md-sys-shape-corner-*`)
`none 0` · `xs 4px` · `sm 8px` · `md 12px` · `lg 16px` · `lg-increased 20px` · `xl 28px` · `xl-increased 32px` · `xxl 48px` · `full 50cqmin` (pills/avatars)

### Elevation (`--md-sys-elevation-shadow-0..5`, `--md-sys-color-shadow`)
- 0: `none` — cards resting flat, flat surfaces
- 1: `0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15)` — search fields, cards
- 2: `0 1px 2px rgba(0,0,0,.3), 0 2px 6px 2px rgba(0,0,0,.15)` — raised cards
- 3: `0 1px 3px rgba(0,0,0,.3), 0 4px 8px 3px rgba(0,0,0,.15)` — FABs
- 4: `0 2px 3px rgba(0,0,0,.3), 0 6px 10px 4px rgba(0,0,0,.15)` — app bar (scrolled), side sheets
- 5: `0 4px 4px rgba(0,0,0,.3), 0 8px 12px 6px rgba(0,0,0,.15)` — dialogs, pickers

### Spacing (`--md-sys-space-*`, labs; 8px unit grid)
`--md-sys-space-unit: 8px`; tokens `--md-sys-space-25/50/75/100/125/150/175/200/250/300` = multiples of the unit. MUST use these (or the 8px grid), NEVER ad-hoc 5px/7px/13px gaps.

## 4. Component mapping — this demo's screens

| Demo need | M3 component (from `@material/web`) | Notes |
|---|---|---|
| Top app bar | Custom: sticky header, `surface-container`, `title-lg`, elevation-2 only when scrolled | material-web has NO top-app-bar; build from tokens, NEVER a MUI AppBar copy |
| Horizontal stepper (8 pipeline stages) | Custom: `md-icon-button` step nodes + `outline-variant` connector track + `label-sm` | M3 has NO stepper web component. States: active = `primary` filled circle + `on-primary` number; done = `secondary-container` + check icon; upcoming = `surface-container-highest` + `outline`. Motion: connector fill `emphasized-decelerate 300ms` |
| Primary CTA | `<md-filled-button>` | label-lg, container `primary`, shape `full` |
| Secondary action | `<md-outlined-button>` | 1px `outline` border, `primary` label |
| Tertiary action | `<md-text-button>` | — |
| Text fields (dataset name, LR, etc.) | `<md-outlined-text-field>` / `<md-filled-text-field>` | label floats to `label-md`; supporting text = `body-sm` `on-surface-variant`; error state = `error` |
| Sliders (learning rate, temperature) | `<md-slider>` | active track `primary`, thumb `primary`, value label `label-md` `on-primary` |
| Cards (stage panels, metrics) | `<md-filled-card>` / `<md-outlined-card>` | `surface-container-low` fill, `corner-lg` 16px; NEVER raw box-shadow |
| Data tables (runs table) | `<md-list>` + `<md-list-item>` or custom table on `surface-container-lowest`, row separators 1px `outline-variant` | Header row = `title-md`, zebra striping FORBIDDEN |
| Linear progress (training) | `<md-linear-progress>` | track `surface-container-highest`, bar `primary`; indeterminate only when duration unknown |
| Dialogs (confirm delete run) | `<md-dialog>` | scrim `scrim` @ 32%, container `surface-container-high`, `corner-xl` 28px, buttons as text-buttons right-aligned |
| Snackbars (run queued, error) | `labs` snackbar (landed 2026-10-07 per repo commits) | `inverse-surface` bg, `inverse-on-surface` text, action text `inverse-primary` |
| Chips/filters (status filters) | `<md-filter-chip>` | selected = `secondary-container` + checkmark |
| Switches/toggles (dark mode, flags) | `<md-switch>` | track `surface-container-highest`, selected thumb `primary` |
| Tabs (code/config/plots) | `<md-tabs>` + `<md-primary-tab>` | indicator 3px `primary`, label `title-sm` |
| Menus/dropdowns | `<md-menu>` | `surface-container`, elevation-2 |

## 5. Motion rules (RFC 2119, M3-exact tokens)

Verified values (`md-motion-tokens-easing.css`):
- `--md-sys-motion-easing-standard: cubic-bezier(0.2, 0, 0, 1)` — UI state changes (default)
- `--md-sys-motion-easing-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1)` — entering/full-screen/step transitions
- `--md-sys-motion-easing-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15)` — exiting
- Durations: `short2 100ms` (hover/focus/ripple) · `short4 200ms` (state change) · `medium2 300ms` (expand/step advance, emphasized-decelerate) · `medium4 400ms` (dialog enter) · `long*` ≤ 600ms for page transitions only
- MUST: interactive feedback ≤ 300ms; use emphasized-decelerate for entrances; ripple on all pressable surfaces (built into components)
- MUST: honor `prefers-reduced-motion` (instant state, no transitions)
- NEVER: linear easing for UI motion, bounce/spring easings, infinite decorative loops, motion that conveys info alone

## 6. Wiring (material-exact, no reinvention)

```bash
npm install @material/web            # 2.5.0 verified on npm registry
```

```html
<!-- per-component imports (tree-shaken) -->
<script type="module">
  import '@material/web/button/filled-button.js';
  import '@material/web/button/outlined-button.js';
  import '@material/web/textfield/outlined-text-field.js';
  import '@material/web/slider/slider.js';
  import '@material/web/progress/linear-progress.js';
  import '@material/web/dialog/dialog.js';
  import '@material/web/list/list.js';
  import '@material/web/chips/filter-chip.js';
  import '@material/web/switch/switch.js';
  import '@material/web/tabs/tabs.js';
  import '@material/web/tabs/primary-tab.js';
</script>
```

```css
/* theming: override SYSTEM tokens only (theming docs: material-web.dev/theming/material-theming/) */
:root {
  --md-sys-color-primary: #6750A4;          /* baseline light */
  --md-sys-color-secondary: #625B71;
  --md-ref-typeface-plain: 'Inter', system-ui, sans-serif; /* brand typeface swap */
  --md-sys-shape-corner-full: 9999px;
}
[data-theme="dark"] {
  --md-sys-color-primary: #D0BCFF;
  --md-sys-color-on-primary: #381E72;
  /* ...dark column from §3... */
}
/* component-token override example (verbatim pattern from docs) */
.stepper-step.active { --md-icon-button-icon-color: var(--md-sys-color-on-primary); }
```
Token SCSS for build-time theming (source of truth, verified in repo): `tokens/_index.scss`, `tokens/_md-sys-color.scss`, `tokens/_md-sys-elevation.scss`, `tokens/_md-sys-motion.scss`, `tokens/_md-sys-shape.scss`, `tokens/_md-sys-state.scss`, `tokens/_md-sys-typescale.scss`, `tokens/_md-ref-palette.scss`. Limits (per official theming docs): MWC does NOT support `--md-ref-palette` or `--md-sys-motion` token overrides — motion easings must be used directly in CSS.

## 7. Fallbacks (one line each)

- **`mui/material-ui`** (https://github.com/mui/material-ui, MIT, 99,194 stars, active today) — React only; use only if the demo stack is React and a component (e.g. Stepper) is needed faster than custom tokens allow; its `createTheme` must be fed the §3 tokens, never its default theme.
- **`hamen/material-3-skill`** (https://github.com/hamen/material-3-skill, MIT, 1,472 stars, 2026-07-15) — M3 skill for AI builds (30+ component patterns, token guidance); use only as a coding reference when material-web can't cover something (e.g. stepper patterns).

## 8. What NOT to do (fake-"Material" tells that kill an HR's first impression)

1. **Wrong shadows:** raw `box-shadow: 0 4px 12px rgba(0,0,0,.25)` — M3 elevation is the exact two-layer penumbra+umbra pairs in §3. Any custom shadow reads as fake.
2. **Wrong ripple:** CSS `:active` scale or custom radial hack — material-web components ship the state-layer + ripple; if a pressable has no `md-ripple` behavior it's wrong.
3. **iOS-style components:** blur-heavy cards, SF-style switches, cupertino sliders, centered titles with back chevron — never. This is M3, not HIG.
4. **Flat "material-ish" colors:** purple gradient backgrounds, `#6200EE` hard-coded buttons, black text on `#EADDFF` — every pairing must come from §2 matrix (contrast kills: `primary-container` text is `#4F378B`, never black).
5. **Elevation abuse:** every card at elevation-5, shadows on full-bleed sections. Most surfaces sit at 0–1; shadow only when a surface floats above another.
6. **Wrong corners:** uniform 8px radius everywhere. M3 shape roles: buttons/chips/avatars = full pill, cards = 12–16px, dialogs = 28px, bottom sheets = 28px top.
7. **Type crimes:** one font-size ramp (12/14/16/18/20) with random weights — use §3 scale verbatim; buttons are `label-lg` 500, not `body-md`.
8. **Dark mode as `filter: invert()` or `#121212` everything** — dark scheme hexes in §3 are tonal (surface `#141218`, containers rise toward `#36343B`), never flat black with gray text.
9. **Linear or ease-in-out transitions on state changes** — §5 easings only; `transition: all .3s ease` is an instant fail.
10. **Mixing systems:** one M3 button next to a hand-rolled Tailwind modal. If it's not an `md-*` component or a token-built custom, it doesn't ship.
