// Zero-dependency tests (Node's built-in node:test). Run: npm test (builds first).
import { test } from "node:test"
import assert from "node:assert/strict"
import {
  chartToLatex,
  defaultSpec,
  validateChartSpec,
  toPreview,
  CHART_TYPES,
} from "../dist/index.js"

const data = {
  header: ["x", "y", "err"],
  rows: [
    ["1", "10", "1.0"],
    ["2", "20", "1.5"],
    ["3", "26", "0.8"],
  ],
}

test("error bars: a series with errorCol emits pgfplots error-bar syntax", () => {
  const spec = { ...defaultSpec(data), type: "scatter", series: [{ col: 1, label: "y", errorCol: 2 }] }
  const tex = chartToLatex(data, spec)
  assert.match(tex, /error bars\/\.cd/)
  assert.match(tex, /y dir=both/)
  assert.match(tex, /y explicit/)
  assert.match(tex, /\(1,10\) \+- \(0,1\)/) // point with its error
  assert.match(tex, /only marks/) // still a scatter
})

test("no error bars when errorCol is absent (backward compatible)", () => {
  const spec = { ...defaultSpec(data), series: [{ col: 1, label: "y" }] }
  const tex = chartToLatex(data, spec)
  assert.doesNotMatch(tex, /error bars/)
  assert.match(tex, /\\addplot coordinates \{\(1,10\) \(2,20\) \(3,26\)\};/)
})

test("histogram: bins a single column via pgfplots hist handler", () => {
  const spec = { ...defaultSpec(data), type: "histogram", bins: 5, series: [{ col: 1, label: "y" }] }
  const tex = chartToLatex(data, spec)
  assert.match(tex, /hist=\{bins=5\}/)
  assert.match(tex, /table\[y index=0\]/)
  assert.match(tex, /ymin=0/)
  assert.match(tex, /\\end\{axis\}/)
  // the three sample values land in the inline table
  assert.match(tex, /\n\s*10\n/)
})

test("histogram preview bins values into bar points", () => {
  const spec = { ...defaultSpec(data), type: "histogram", bins: 3, series: [{ col: 1, label: "y" }] }
  const series = toPreview(data, spec)
  assert.equal(series.length, 1)
  const total = series[0].points.reduce((n, p) => n + p.y, 0)
  assert.equal(total, 3) // every sample counted exactly once
})

test("preview carries the error on points when errorCol is set", () => {
  const spec = { ...defaultSpec(data), series: [{ col: 1, label: "y", errorCol: 2 }] }
  const series = toPreview(data, spec)
  assert.equal(series[0].points[0].error, 1)
  assert.equal(series[0].points[1].error, 1.5)
})

test("validateChartSpec accepts histogram, bins, errorCol; defaults the rest", () => {
  const v = validateChartSpec(
    { type: "histogram", bins: 7, series: [{ col: 1, label: "y", errorCol: 2 }], xCol: 0 },
    data,
  )
  assert.equal(v.type, "histogram")
  assert.equal(v.bins, 7)
  assert.equal(v.series[0].errorCol, 2)
})

test("validateChartSpec rejects junk and falls back to defaults", () => {
  const v = validateChartSpec({ type: "pie", bins: -3, series: [{ col: 99, label: "x" }] }, data)
  assert.equal(v.type, "line") // unknown type → default
  assert.equal(v.bins, 10) // invalid bins → default
  assert.equal(v.series.length, 0) // out-of-range col dropped
})

test("CHART_TYPES advertises histogram", () => {
  assert.ok(CHART_TYPES.some((t) => t.value === "histogram"))
})
