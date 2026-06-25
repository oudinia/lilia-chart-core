# @lilia/chart-core

Framework-agnostic core for the Lilia LaTeX **chart** tool. Pure TypeScript — no
React/DOM/RN/IO. A chart = **tabular data + a chart spec**; the canonical
generator turns `(ChartData, ChartSpec)` → **pgfplots** LaTeX.

Sibling of `@lilia/table-core` — `ChartData` is a subset of `TableData`
(`{ header, rows }`), so the same grid / paste editor feeds both tools.

## API
```ts
import {
  type ChartType, type ChartData, type ChartSpec, type Series, type PreviewSeries,
  CHART_TYPES, SERIES_COLORS, CHART_SAMPLE_DATA,
  defaultSpec,        // sensible default mapping: x = col 0, series = the rest
  chartToLatex,       // (data, spec) -> pgfplots (line/bar/scatter; numeric or symbolic x)
  toPreview,          // (data, spec) -> series points for a client-side SVG preview
  validateChartSpec,  // coerce an unknown (stored draft) into a valid ChartSpec
} from '@lilia/chart-core'
```
- `line` → `\addplot` lines · `bar` → `ybar` axis · `scatter` → `[only marks]`.
- Non-numeric x → `symbolic x coords` + `xtick=data`.
- The **preview** is client-side (toPreview → draw an SVG); **pgfplots is the authoritative
  output**. The editor renders the chart with the real LaTeX engine on the "Open in Lilia" path.

Builds NodeNext-ish ESM + `.d.ts`; consume from bundlers (Next/Turbopack, Metro). Same
single-source plan as table-core (publish, then drop vendored copies).
