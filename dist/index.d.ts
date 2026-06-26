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
export type ChartType = "line" | "bar" | "scatter" | "histogram";
/** A subset of table-core's TableData — header + string rows (cells are raw values). */
export interface ChartData {
    header: string[];
    rows: string[][];
}
export interface Series {
    /** column index into `header` / each row */
    col: number;
    label: string;
    /**
     * Optional column index for a symmetric y-error. When set (and numeric),
     * this series draws error bars: `(x,y) +- (0,err)`. line/scatter/bar.
     */
    errorCol?: number;
}
export interface ChartSpec {
    type: ChartType;
    /** column index used for the x axis */
    xCol: number;
    series: Series[];
    title: string;
    xlabel: string;
    ylabel: string;
    legend: boolean;
    grid: boolean;
    xmode: "normal" | "log";
    ymode: "normal" | "log";
    /** Number of bins for `type==="histogram"` (ignored otherwise). */
    bins: number;
}
export declare const CHART_TYPES: {
    value: ChartType;
    label: string;
}[];
/** pgfplots-friendly cycle (named colors that ship with pgfplots/xcolor). */
export declare const SERIES_COLORS: readonly ["blue", "red", "teal", "orange", "violet", "brown", "black"];
export declare const CHART_SAMPLE_DATA: ChartData;
/**
 * Parse pasted Excel / Google Sheets / CSV text into ChartData (first row =
 * header). Mirrors @lilia/table-core's `parsePaste` delimiter rules — tab wins
 * over comma, ragged rows padded to the widest, cells trimmed — so the same
 * paste-grid feeds both the table and the chart tools. Returns empty ChartData
 * when there's nothing tabular.
 */
export declare function parseDelimited(text: string): ChartData;
/** Default spec for a dataset: x = first column, every other column a series. */
export declare function defaultSpec(data: ChartData): ChartSpec;
/**
 * Generate pgfplots LaTeX for (data, spec). The canonical generator — shared by
 * every Lilia surface so "data → chart" never diverges.
 *
 * - `line`      → default `\addplot` lines.
 * - `bar`       → `ybar` axis; numeric or symbolic x.
 * - `scatter`   → `only marks`.
 * - `histogram` → bins a single value column (`series[0]`) with pgfplots `hist`.
 * A series with an `errorCol` draws symmetric y error bars (`+- (0,err)`).
 * Non-numeric x columns become `symbolic x coords` with `xtick=data`.
 *
 * Output is the `tikzpicture` only — for a compilable document the surface must
 * supply the pgfplots preamble (`\usepackage{pgfplots}\pgfplotsset{compat=1.18}`).
 */
export declare function chartToLatex(data: ChartData, spec: ChartSpec): string;
/** Project the (data, spec) into plain {x, points:[{label, points:[{x,y}]}]} for a
 *  client-side SVG preview (preview only — pgfplots is the real output). */
/**
 * Pinned pgfplots `compat` level. `chartToLatex` output is generated against
 * this; bump deliberately (it changes spacing/legend/axis defaults).
 */
export declare const PGFPLOTS_COMPAT = "1.18";
/**
 * The preamble lines a document needs to compile `chartToLatex` output.
 * `chartToLatex` returns only the `tikzpicture`, so a bare paste fails without
 * this — every surface should show it ("add this to your preamble").
 */
export declare function requiredPreamble(): string;
export interface DocumentOptions {
    /** `standalone` (tight crop — good for a single figure, default) or `article`. */
    documentClass?: "standalone" | "article";
}
/**
 * A full, compilable LaTeX document wrapping the chart — the "copy full example"
 * / Overleaf paste-and-go form. Default `standalone` crops to the figure.
 */
export declare function chartToLatexDocument(data: ChartData, spec: ChartSpec, opts?: DocumentOptions): string;
/**
 * The three copy modes a chart surface offers, generated consistently from one
 * (data, spec) so "data → chart" never diverges across web / editor / mobile:
 *  - `figure`       → the `tikzpicture` only (paste into a doc that already
 *                     loads pgfplots — e.g. inside Lilia, where the preamble is managed).
 *  - `withPreamble` → the figure annotated with the preamble lines it needs.
 *  - `document`     → a full compilable standalone document (Overleaf paste-and-go).
 */
export interface ChartOutputs {
    figure: string;
    withPreamble: string;
    document: string;
}
export declare function chartOutputs(data: ChartData, spec: ChartSpec): ChartOutputs;
export interface PreviewPoint {
    x: number;
    y: number;
    xLabel: string;
    /** symmetric y-error, present when the series has an `errorCol`. */
    error?: number;
}
export interface PreviewSeries {
    label: string;
    color: string;
    points: PreviewPoint[];
}
export declare function toPreview(data: ChartData, spec: ChartSpec): PreviewSeries[];
/** Defensive coercion of an unknown (e.g. a stored draft) into a valid ChartSpec. */
export declare function validateChartSpec(x: unknown, data: ChartData): ChartSpec;
