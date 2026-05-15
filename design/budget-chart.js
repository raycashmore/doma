/**
 * @schema 2.10
 * @input mode: enum("full", "lines") = "full"
 */

const W = pencil.width;
const H = pencil.height;
const mode = pencil.input.mode;

// 24 mocked monthly observations (oldest → newest), [spend, sinkOrSwim].
// Same shape as BudgetDataPoint in apps/budget/src/lib/budget.ts.
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
const plotH = H - 6;
const yScale = (v) => plotH - (v / yMax) * plotH;

const groupGap = mode === "lines" ? 0 : 5;
const groupW = (W - groupGap * (N - 1)) / N;
const barGap = 1;
const barW = (groupW - barGap) / 2;

const SPEND = "#3D2E22";
const SOS = "#D9893A";
const SPEND_LINE = "#7C6755";
const SOS_LINE = "#D85A36";

const nodes = [];

if (mode === "full") {
  for (let i = 0; i < N; i++) {
    const [s, sos] = data[i];
    const x = i * (groupW + groupGap);
    nodes.push({
      type: "rectangle",
      x: x,
      y: yScale(sos),
      width: barW,
      height: plotH - yScale(sos),
      fill: SOS,
      cornerRadius: [3, 3, 0, 0]
    });
    nodes.push({
      type: "rectangle",
      x: x + barW + barGap,
      y: yScale(s),
      width: barW,
      height: plotH - yScale(s),
      fill: SPEND,
      cornerRadius: [3, 3, 0, 0]
    });
  }
}

// Moving averages, window = 6 (matches BudgetChart's MA_WINDOW).
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

nodes.push({
  type: "path",
  x: 0,
  y: 0,
  width: W,
  height: H,
  viewBox: [0, 0, W, H],
  geometry: pathStr(sosMA),
  stroke: {
    fill: SOS_LINE,
    thickness: mode === "lines" ? 3 : 2.5,
    align: "center",
    cap: "round",
    join: "round"
  }
});

nodes.push({
  type: "path",
  x: 0,
  y: 0,
  width: W,
  height: H,
  viewBox: [0, 0, W, H],
  geometry: pathStr(spendMA),
  stroke: {
    fill: SPEND_LINE,
    thickness: mode === "lines" ? 3 : 2.5,
    align: "center",
    cap: "round",
    join: "round"
  }
});

return nodes;
