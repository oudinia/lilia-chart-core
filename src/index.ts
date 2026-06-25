/**
 * @lilia/chart-core — framework-agnostic core for the Lilia LaTeX **chart** tool.
 *
 * Pure TypeScript (no React/DOM/RN/IO). A chart = tabular data + a chart spec.
 * The canonical generator turns (data, spec) → **pgfplots** LaTeX. Shared by the
 * web tool (lilia-cloud / PWA) and the React Native app (lilia-mobile); each
 * supplies its own UI, preview, storage, and API wiring.
 *
 * Sibling to @lilia/table-core — the data shape is intentionally a subset of
 * table-core's TableData, so the same grid / paste editor feeds both.
 */

export type ChartType = "line" | "bar" | "scatter"

/** A subset of table-core's TableData — header + string rows (cells are raw values). */
export interface ChartData {
  header: string[]
  rows: string[][]
}

export interface Series {
  /** column index into `header` / each row */
  col: number
  label: string
}

export interface ChartSpec {
  type: ChartType
  /** column index used for the x axis */
  xCol: number
  series: Series[]
  title: string
  xlabel: string
  ylabel: string
  legend: boolean
  grid: boolean
  xmode: "normal" | "log"
  ymode: "normal" | "log"
}

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "line", label: "Line" },
  { value: "bar", label: "Bar" },
  { value: "scatter", label: "Scatter" },
]

/** pgfplots-friendly cycle (named colors that ship with pgfplots/xcolor). */
export const SERIES_COLORS = ["blue", "red", "teal", "orange", "violet", "brown", "black"] as const

export const CHART_SAMPLE_DATA: ChartData = {
  header: ["Epoch", "Baseline", "Ours"],
  rows: [
    ["1", "0.71", "0.74"],
    ["2", "0.82", "0.88"],
    ["3", "0.86", "0.93"],
    ["4", "0.88", "0.95"],
  ],
}

/** Default spec for a dataset: x = first column, every other column a series. */
export function defaultSpec(data: ChartData): ChartSpec {
  const series: Series[] = data.header
    .map((label, col) => ({ col, label }))
    .filter((s) => s.col !== 0)
  return {
    type: "line",
    xCol: 0,
    series,
    title: "",
    xlabel: data.header[0] ?? "x",
    ylabel: "",
    legend: true,
    grid: true,
    xmode: "normal",
    ymode: "normal",
  }
}

const num = (s: string): number | null => {
  if (s == null) return null
  const v = Number(String(s).replace(/[$,%\s]/g, ""))
  return Number.isFinite(v) ? v : null
}

const isNumericCol = (data: ChartData, col: number): boolean =>
  data.rows.length > 0 && data.rows.every((r) => num(r[col]) !== null)

/** Minimal LaTeX escaping for axis labels / titles / legend entries. */
function esc(s: string): string {
  return (s ?? "").replace(/([#$%&_{}])/g, "\\$1")
}

/**
 * Generate pgfplots LaTeX for (data, spec). The canonical generator — shared by
 * every Lilia surface so "data → chart" never diverges.
 *
 * - `line`    → default `\addplot` lines.
 * - `bar`     → `ybar` axis; numeric or symbolic x.
 * - `scatter` → `only marks`.
 * Non-numeric x columns become `symbolic x coords` with `xtick=data`.
 */
export function chartToLatex(data: ChartData, spec: ChartSpec): string {
  const I = "    "
  const xNumeric = isNumericCol(data, spec.xCol)
  const xValues = data.rows.map((r) => r[spec.xCol] ?? "")

  const axisOpts: string[] = []
  if (spec.title) axisOpts.push(`title={${esc(spec.title)}}`)
  if (spec.xlabel) axisOpts.push(`xlabel={${esc(spec.xlabel)}}`)
  if (spec.ylabel) axisOpts.push(`ylabel={${esc(spec.ylabel)}}`)
  if (spec.legend) axisOpts.push("legend pos=north west")
  if (spec.grid) axisOpts.push("grid=both")
  if (spec.type === "bar") axisOpts.push("ybar")
  if (spec.xmode === "log") axisOpts.push("xmode=log")
  if (spec.ymode === "log") axisOpts.push("ymode=log")
  if (!xNumeric) {
    axisOpts.push(`symbolic x coords={${xValues.map((v) => esc(v)).join(", ")}}`)
    axisOpts.push("xtick=data")
  }

  const plotOpt = spec.type === "scatter" ? "[only marks]" : ""

  const L: string[] = ["\\begin{tikzpicture}"]
  L.push(I + "\\begin{axis}[")
  axisOpts.forEach((o, i) => L.push(I + I + o + (i < axisOpts.length - 1 ? "," : "")))
  L.push(I + "]")

  spec.series.forEach((s) => {
    const coords = data.rows
      .map((r) => {
        const x = xNumeric ? num(r[spec.xCol]) : r[spec.xCol]
        const y = num(r[s.col])
        if (x == null || x === "" || y == null) return null
        return `(${xNumeric ? x : esc(String(x))},${y})`
      })
      .filter(Boolean)
      .join(" ")
    L.push(I + I + `\\addplot${plotOpt} coordinates {${coords}};`)
    if (spec.legend) L.push(I + I + `\\addlegendentry{${esc(s.label)}}`)
  })

  L.push(I + "\\end{axis}", "\\end{tikzpicture}")
  return L.join("\n")
}

/** Project the (data, spec) into plain {x, points:[{label, points:[{x,y}]}]} for a
 *  client-side SVG preview (preview only — pgfplots is the real output). */
export interface PreviewSeries {
  label: string
  color: string
  points: { x: number; y: number; xLabel: string }[]
}
export function toPreview(data: ChartData, spec: ChartSpec): PreviewSeries[] {
  const xNumeric = isNumericCol(data, spec.xCol)
  return spec.series.map((s, si) => ({
    label: s.label,
    color: SERIES_COLORS[si % SERIES_COLORS.length],
    points: data.rows
      .map((r, ri) => {
        const y = num(r[s.col])
        if (y == null) return null
        const x = xNumeric ? (num(r[spec.xCol]) ?? ri) : ri
        return { x, y, xLabel: r[spec.xCol] ?? String(ri) }
      })
      .filter((p): p is { x: number; y: number; xLabel: string } => p !== null),
  }))
}

/** Defensive coercion of an unknown (e.g. a stored draft) into a valid ChartSpec. */
export function validateChartSpec(x: unknown, data: ChartData): ChartSpec {
  const base = defaultSpec(data)
  if (!x || typeof x !== "object") return base
  const s = x as Partial<ChartSpec>
  const cols = data.header.length
  const okCol = (n: unknown) => typeof n === "number" && n >= 0 && n < cols
  return {
    type: (["line", "bar", "scatter"] as ChartType[]).includes(s.type as ChartType) ? (s.type as ChartType) : base.type,
    xCol: okCol(s.xCol) ? (s.xCol as number) : base.xCol,
    series: Array.isArray(s.series) ? s.series.filter((se) => okCol(se?.col)).map((se) => ({ col: se.col, label: String(se.label ?? "") })) : base.series,
    title: typeof s.title === "string" ? s.title : base.title,
    xlabel: typeof s.xlabel === "string" ? s.xlabel : base.xlabel,
    ylabel: typeof s.ylabel === "string" ? s.ylabel : base.ylabel,
    legend: typeof s.legend === "boolean" ? s.legend : base.legend,
    grid: typeof s.grid === "boolean" ? s.grid : base.grid,
    xmode: s.xmode === "log" ? "log" : "normal",
    ymode: s.ymode === "log" ? "log" : "normal",
  }
}
