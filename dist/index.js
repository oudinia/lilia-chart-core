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
export const CHART_TYPES = [
    { value: "line", label: "Line" },
    { value: "bar", label: "Bar" },
    { value: "scatter", label: "Scatter" },
    { value: "histogram", label: "Histogram" },
];
/** pgfplots-friendly cycle (named colors that ship with pgfplots/xcolor). */
export const SERIES_COLORS = ["blue", "red", "teal", "orange", "violet", "brown", "black"];
export const CHART_SAMPLE_DATA = {
    header: ["Epoch", "Baseline", "Ours"],
    rows: [
        ["1", "0.71", "0.74"],
        ["2", "0.82", "0.88"],
        ["3", "0.86", "0.93"],
        ["4", "0.88", "0.95"],
    ],
};
/**
 * Parse pasted Excel / Google Sheets / CSV text into ChartData (first row =
 * header). Mirrors @lilia/table-core's `parsePaste` delimiter rules — tab wins
 * over comma, ragged rows padded to the widest, cells trimmed — so the same
 * paste-grid feeds both the table and the chart tools. Returns empty ChartData
 * when there's nothing tabular.
 */
export function parseDelimited(text) {
    const lines = String(text ?? "")
        .replace(/\r/g, "")
        .split("\n")
        .filter((l) => l.trim().length > 0);
    if (lines.length === 0)
        return { header: [], rows: [] };
    const delim = lines[0].includes("\t") ? "\t" : ",";
    const grid = lines.map((l) => l.split(delim).map((c) => c.trim()));
    const cols = Math.max(...grid.map((r) => r.length));
    const norm = grid.map((r) => {
        const x = r.slice();
        while (x.length < cols)
            x.push("");
        return x;
    });
    return { header: norm[0], rows: norm.slice(1) };
}
/** Default spec for a dataset: x = first column, every other column a series. */
export function defaultSpec(data) {
    const series = data.header
        .map((label, col) => ({ col, label }))
        .filter((s) => s.col !== 0);
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
        bins: 10,
    };
}
const num = (s) => {
    if (s == null)
        return null;
    const v = Number(String(s).replace(/[$,%\s]/g, ""));
    return Number.isFinite(v) ? v : null;
};
const isNumericCol = (data, col) => data.rows.length > 0 && data.rows.every((r) => num(r[col]) !== null);
/** Minimal LaTeX escaping for axis labels / titles / legend entries. */
function esc(s) {
    return (s ?? "").replace(/([#$%&_{}])/g, "\\$1");
}
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
export function chartToLatex(data, spec) {
    if (spec.type === "histogram")
        return histogramToLatex(data, spec);
    const I = "    ";
    const xNumeric = isNumericCol(data, spec.xCol);
    const xValues = data.rows.map((r) => r[spec.xCol] ?? "");
    const axisOpts = [];
    if (spec.title)
        axisOpts.push(`title={${esc(spec.title)}}`);
    if (spec.xlabel)
        axisOpts.push(`xlabel={${esc(spec.xlabel)}}`);
    if (spec.ylabel)
        axisOpts.push(`ylabel={${esc(spec.ylabel)}}`);
    if (spec.legend)
        axisOpts.push("legend pos=north west");
    if (spec.grid)
        axisOpts.push("grid=both");
    if (spec.type === "bar")
        axisOpts.push("ybar");
    if (spec.xmode === "log")
        axisOpts.push("xmode=log");
    if (spec.ymode === "log")
        axisOpts.push("ymode=log");
    if (!xNumeric) {
        axisOpts.push(`symbolic x coords={${xValues.map((v) => esc(v)).join(", ")}}`);
        axisOpts.push("xtick=data");
    }
    const L = ["\\begin{tikzpicture}"];
    L.push(I + "\\begin{axis}[");
    axisOpts.forEach((o, i) => L.push(I + I + o + (i < axisOpts.length - 1 ? "," : "")));
    L.push(I + "]");
    spec.series.forEach((s) => {
        const hasErr = s.errorCol != null && isNumericCol(data, s.errorCol);
        const opts = [];
        if (spec.type === "scatter")
            opts.push("only marks");
        if (hasErr)
            opts.push("error bars/.cd", "y dir=both", "y explicit");
        const optStr = opts.length ? `[${opts.join(", ")}]` : "";
        const coords = data.rows
            .map((r) => {
            const x = xNumeric ? num(r[spec.xCol]) : r[spec.xCol];
            const y = num(r[s.col]);
            if (x == null || x === "" || y == null)
                return null;
            const point = `(${xNumeric ? x : esc(String(x))},${y})`;
            if (hasErr) {
                const e = num(r[s.errorCol]);
                return e == null ? point : `${point} +- (0,${e})`;
            }
            return point;
        })
            .filter(Boolean)
            .join(" ");
        L.push(I + I + `\\addplot${optStr} coordinates {${coords}};`);
        if (spec.legend)
            L.push(I + I + `\\addlegendentry{${esc(s.label)}}`);
    });
    L.push(I + "\\end{axis}", "\\end{tikzpicture}");
    return L.join("\n");
}
/**
 * Histogram of a single value column (`series[0]`, falling back to `xCol`).
 * Uses pgfplots' `hist` handler on inline samples — `hist={bins=N}` bins the
 * column and draws the bars (needs `\usepackage{pgfplots}` in the preamble).
 */
function histogramToLatex(data, spec) {
    const I = "    ";
    const sampleCol = spec.series[0]?.col ?? spec.xCol;
    const colLabel = spec.series[0]?.label ?? data.header[sampleCol] ?? "value";
    const bins = Math.max(1, Math.floor(spec.bins || 10));
    const values = data.rows
        .map((r) => num(r[sampleCol]))
        .filter((v) => v != null);
    const axisOpts = [];
    if (spec.title)
        axisOpts.push(`title={${esc(spec.title)}}`);
    axisOpts.push(`xlabel={${esc(spec.xlabel || colLabel)}}`);
    axisOpts.push(`ylabel={${esc(spec.ylabel || "Count")}}`);
    axisOpts.push("ymin=0");
    if (spec.grid)
        axisOpts.push("grid=both");
    if (spec.xmode === "log")
        axisOpts.push("xmode=log");
    const L = ["\\begin{tikzpicture}", I + "\\begin{axis}["];
    axisOpts.forEach((o, i) => L.push(I + I + o + (i < axisOpts.length - 1 ? "," : "")));
    L.push(I + "]");
    L.push(I + I + `\\addplot+[hist={bins=${bins}}, fill] table[y index=0] {`);
    L.push(I + I + I + "samples");
    values.forEach((v) => L.push(I + I + I + String(v)));
    L.push(I + I + "};");
    L.push(I + "\\end{axis}", "\\end{tikzpicture}");
    return L.join("\n");
}
/** Project the (data, spec) into plain {x, points:[{label, points:[{x,y}]}]} for a
 *  client-side SVG preview (preview only — pgfplots is the real output). */
/**
 * Pinned pgfplots `compat` level. `chartToLatex` output is generated against
 * this; bump deliberately (it changes spacing/legend/axis defaults).
 */
export const PGFPLOTS_COMPAT = "1.18";
/**
 * The preamble lines a document needs to compile `chartToLatex` output.
 * `chartToLatex` returns only the `tikzpicture`, so a bare paste fails without
 * this — every surface should show it ("add this to your preamble").
 */
export function requiredPreamble() {
    return `\\usepackage{pgfplots}\n\\pgfplotsset{compat=${PGFPLOTS_COMPAT}}`;
}
/**
 * A full, compilable LaTeX document wrapping the chart — the "copy full example"
 * / Overleaf paste-and-go form. Default `standalone` crops to the figure.
 */
export function chartToLatexDocument(data, spec, opts = {}) {
    const cls = opts.documentClass ?? "standalone";
    const docclass = cls === "standalone" ? "\\documentclass[border=4pt]{standalone}" : "\\documentclass{article}";
    return [docclass, requiredPreamble(), "\\begin{document}", chartToLatex(data, spec), "\\end{document}", ""].join("\n");
}
export function chartOutputs(data, spec) {
    const figure = chartToLatex(data, spec);
    const withPreamble = [
        "% ── add these lines to your preamble ──",
        requiredPreamble(),
        "",
        "% ── the figure (in your document body) ──",
        figure,
    ].join("\n");
    return { figure, withPreamble, document: chartToLatexDocument(data, spec) };
}
export function toPreview(data, spec) {
    if (spec.type === "histogram")
        return histogramPreview(data, spec);
    const xNumeric = isNumericCol(data, spec.xCol);
    return spec.series.map((s, si) => {
        const hasErr = s.errorCol != null && isNumericCol(data, s.errorCol);
        return {
            label: s.label,
            color: SERIES_COLORS[si % SERIES_COLORS.length],
            points: data.rows
                .map((r, ri) => {
                const y = num(r[s.col]);
                if (y == null)
                    return null;
                const x = xNumeric ? (num(r[spec.xCol]) ?? ri) : ri;
                const e = hasErr ? num(r[s.errorCol]) : null;
                const p = { x, y, xLabel: r[spec.xCol] ?? String(ri) };
                if (e != null)
                    p.error = e;
                return p;
            })
                .filter((p) => p !== null),
        };
    });
}
/** Bin the histogram's sample column into bar points (bin center → count). */
function histogramPreview(data, spec) {
    const sampleCol = spec.series[0]?.col ?? spec.xCol;
    const label = spec.series[0]?.label ?? data.header[sampleCol] ?? "count";
    const values = data.rows.map((r) => num(r[sampleCol])).filter((v) => v != null);
    if (values.length === 0)
        return [{ label, color: SERIES_COLORS[0], points: [] }];
    const min = Math.min(...values);
    const max = Math.max(...values);
    const bins = Math.max(1, Math.floor(spec.bins || 10));
    const width = (max - min) / bins || 1;
    const counts = new Array(bins).fill(0);
    for (const v of values) {
        let i = Math.floor((v - min) / width);
        if (i >= bins)
            i = bins - 1;
        if (i < 0)
            i = 0;
        counts[i] += 1;
    }
    return [
        {
            label,
            color: SERIES_COLORS[0],
            points: counts.map((c, i) => {
                const center = min + (i + 0.5) * width;
                return { x: center, y: c, xLabel: center.toFixed(2) };
            }),
        },
    ];
}
/** Defensive coercion of an unknown (e.g. a stored draft) into a valid ChartSpec. */
export function validateChartSpec(x, data) {
    const base = defaultSpec(data);
    if (!x || typeof x !== "object")
        return base;
    const s = x;
    const cols = data.header.length;
    const okCol = (n) => typeof n === "number" && n >= 0 && n < cols;
    return {
        type: ["line", "bar", "scatter", "histogram"].includes(s.type) ? s.type : base.type,
        xCol: okCol(s.xCol) ? s.xCol : base.xCol,
        series: Array.isArray(s.series)
            ? s.series.filter((se) => okCol(se?.col)).map((se) => {
                const out = { col: se.col, label: String(se.label ?? "") };
                if (okCol(se.errorCol))
                    out.errorCol = se.errorCol;
                return out;
            })
            : base.series,
        title: typeof s.title === "string" ? s.title : base.title,
        xlabel: typeof s.xlabel === "string" ? s.xlabel : base.xlabel,
        ylabel: typeof s.ylabel === "string" ? s.ylabel : base.ylabel,
        legend: typeof s.legend === "boolean" ? s.legend : base.legend,
        grid: typeof s.grid === "boolean" ? s.grid : base.grid,
        xmode: s.xmode === "log" ? "log" : "normal",
        ymode: s.ymode === "log" ? "log" : "normal",
        bins: typeof s.bins === "number" && s.bins >= 1 ? Math.floor(s.bins) : base.bins,
    };
}
