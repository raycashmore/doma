/**
 * @schema 2.10
 */

const W = pencil.width;
const H = pencil.height;

const data = [
  [4200, 3800], [4400, 4100], [4100, 3900], [4500, 4300],
  [4800, 5100], [4600, 4800], [5200, 5300], [4900, 5200],
  [4700, 4900], [5100, 5400], [5300, 5800], [6200, 6900],
  [4800, 5100], [5000, 5400], [4900, 5200], [5200, 5600],
  [5400, 6100], [5300, 5900], [5600, 6300], [5800, 6600],
  [5500, 6200], [5900, 6800], [6100, 7100], [7200, 8400]
];

const N = data.length;
const yMax = 10000;
const padTop = 24;
const padBottom = 0;
const plotH = H - padTop - padBottom;
const yScale = (v) => padTop + plotH - (v / yMax) * plotH;

const groupGap = 6;
const groupW = (W - groupGap * (N - 1)) / N;
const barGap = 1;
const barW = (groupW - barGap) / 2;

const INK = "#000000";
const ACCENT = "#007AFF";

const nodes = [];

// Year-boundary verticals (months 0 and 12 are Jun '24 / Jun '25). Placed at
// month indices 0, 12 = Jan boundaries. For our 24-month set Jan '25 ~ idx 7,
// Jan '26 ~ idx 19. Mark Jan-of-year breaks.
const yearBreaks = [7, 19];
for (const idx of yearBreaks) {
  const x = idx * (groupW + groupGap) + groupW / 2;
  nodes.push({
    type: "rectangle",
    x: x,
    y: padTop,
    width: 0.5,
    height: plotH,
    fill: { type: "color", color: INK, blendMode: "normal" },
    opacity: 0.18
  });
}

// Soft gray bars — actuals as a subdued texture
for (let i = 0; i < N; i++) {
  const [s, sos] = data[i];
  const x = i * (groupW + groupGap);
  // sink-or-swim bar
  nodes.push({
    type: "rectangle",
    x: x,
    y: yScale(sos),
    width: barW,
    height: padTop + plotH - yScale(sos),
    fill: INK,
    opacity: 0.08
  });
  // spend bar
  nodes.push({
    type: "rectangle",
    x: x + barW + barGap,
    y: yScale(s),
    width: barW,
    height: padTop + plotH - yScale(s),
    fill: INK,
    opacity: 0.16
  });
}

// 6-month moving averages (matches lib/budget.ts MA_WINDOW)
const win = 6;
function ma(arr) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= win) sum -= arr[i - win];
    out.push(sum / Math.min(win, i + 1));
  }
  return out;
}
const spendMA = ma(data.map((d) => d[0]));
const sosMA = ma(data.map((d) => d[1]));

function pathStr(arr) {
  let d = "";
  for (let i = 0; i < arr.length; i++) {
    const x = i * (groupW + groupGap) + groupW / 2;
    const y = yScale(arr[i]);
    d += (i === 0 ? "M" : " L") + x.toFixed(1) + " " + y.toFixed(1);
  }
  return d;
}

// Sink-or-swim line — solid hairline ink
nodes.push({
  type: "path",
  x: 0,
  y: 0,
  width: W,
  height: H,
  viewBox: [0, 0, W, H],
  geometry: pathStr(sosMA),
  stroke: { fill: INK, thickness: 1.2, align: "center", cap: "round", join: "round" }
});

// Spend line — dashed hairline ink
nodes.push({
  type: "path",
  x: 0,
  y: 0,
  width: W,
  height: H,
  viewBox: [0, 0, W, H],
  geometry: pathStr(spendMA),
  stroke: {
    fill: INK,
    thickness: 1.2,
    align: "center",
    cap: "square",
    join: "round",
    dashPattern: [3, 3]
  }
});

// Latest-point indicator — accent dot + halo
const lastX = (N - 1) * (groupW + groupGap) + groupW / 2;
const lastSosY = yScale(sosMA[N - 1]);
nodes.push({
  type: "ellipse",
  x: lastX - 9,
  y: lastSosY - 9,
  width: 18,
  height: 18,
  fill: ACCENT,
  opacity: 0.15
});
nodes.push({
  type: "ellipse",
  x: lastX - 4,
  y: lastSosY - 4,
  width: 8,
  height: 8,
  fill: ACCENT
});

// Annotation arc, low-opacity construction line — sweeps from the last point
// out toward the floating callout that sits to the upper-right.
const arcR = 90;
nodes.push({
  type: "path",
  x: 0,
  y: 0,
  width: W,
  height: H,
  viewBox: [0, 0, W, H],
  geometry:
    "M " +
    (lastX - 0.5).toFixed(1) +
    " " +
    (lastSosY - arcR).toFixed(1) +
    " A " +
    arcR +
    " " +
    arcR +
    " 0 0 0 " +
    (lastX - arcR).toFixed(1) +
    " " +
    (lastSosY - 0.5).toFixed(1),
  stroke: { fill: ACCENT, thickness: 0.75, align: "center", cap: "round", join: "round" },
  opacity: 0.5
});

return nodes;
