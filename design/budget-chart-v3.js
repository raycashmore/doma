/**
 * @schema 2.10
 * @input mode: enum("full", "lines") = "full"
 */

const W = pencil.width;
const H = pencil.height;
const mode = pencil.input.mode;

// 24 mocked monthly observations (oldest to newest), [mortgage, discretionary, income].
const data = [
  [2850, 3550, 5200],
  [2850, 3850, 5400],
  [2850, 3450, 5250],
  [2850, 4050, 5600],
  [2850, 3750, 5750],
  [2850, 3950, 5900],
  [2850, 3650, 6100],
  [2850, 3350, 6250],
  [2850, 3150, 6200],
  [2850, 3350, 6500],
  [2850, 3050, 6650],
  [2850, 3550, 6900],
  [2920, 2880, 6750],
  [2920, 2680, 7050],
  [2920, 2780, 7200],
  [2920, 2480, 7350],
  [2920, 2580, 7600],
  [2920, 2380, 7450],
  [2920, 2280, 7800],
  [2920, 2480, 8050],
  [2920, 2180, 7900],
  [2920, 2380, 8250],
  [2920, 2580, 8500],
  [2920, 2280, 8700]
];

const N = data.length;
const yMax = 10000;
const plotH = H - 8;
const yScale = (v) => plotH - (v / yMax) * plotH;

const groupGap = mode === 'lines' ? 0 : Math.max(3, W / 140);
const groupW = (W - groupGap * (N - 1)) / N;
const incomeBarW = Math.max(3, groupW * 0.78);
const spendBarW = Math.max(2, groupW * 0.52);

const MORTGAGE = '#3D2E227A';
const DISCRETIONARY = '#D85A3670';
const INCOME = '#5F946666';
const MORTGAGE_LINE = '#3D2E22';
const DISCRETIONARY_LINE = '#D85A36';
const INCOME_LINE = '#5F9466';
const GRID = '#EFE3D2';
const TEXT = '#3D2E22';
const MUTED = '#7C6755';
const CARD = '#FFFCF6';

const nodes = [];

if (mode === 'full') {
  [0.25, 0.5, 0.75].forEach((t) => {
    nodes.push({
      type: 'line',
      x: 0,
      y: plotH * t,
      width: W,
      height: 0.01,
      stroke: { fill: GRID, thickness: 1, align: 'center' },
      opacity: 0.55
    });
  });
}

const mortgage = data.map((d) => d[0]);
const spend = data.map((d) => d[0] + d[1]);
const income = data.map((d) => d[2]);

function pointX(i) {
  return i * (groupW + groupGap) + groupW / 2;
}

function ma(arr, win) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i];
    if (i >= win) sum -= arr[i - win];
    out.push(sum / Math.min(win, i + 1));
  }
  return out;
}

function linePath(arr) {
  let d = '';
  for (let i = 0; i < arr.length; i++) {
    d += (i === 0 ? 'M' : ' L') + pointX(i).toFixed(1) + ' ' + yScale(arr[i]).toFixed(1);
  }
  return d;
}

if (mode === 'full') {
  for (let i = 0; i < N; i++) {
    const [m, d, inc] = data[i];
    const cx = pointX(i);
    const incomeTop = yScale(inc);
    const mortgageTop = yScale(m);
    const totalTop = yScale(m + d);

    nodes.push({
      type: 'rectangle',
      x: cx - incomeBarW / 2,
      y: incomeTop,
      width: incomeBarW,
      height: plotH - incomeTop,
      fill: INCOME,
      cornerRadius: [4, 4, 0, 0]
    });

    nodes.push({
      type: 'rectangle',
      x: cx - spendBarW / 2,
      y: mortgageTop,
      width: spendBarW,
      height: plotH - mortgageTop,
      fill: MORTGAGE,
      cornerRadius: [3, 3, 0, 0]
    });

    nodes.push({
      type: 'rectangle',
      x: cx - spendBarW / 2,
      y: totalTop,
      width: spendBarW,
      height: mortgageTop - totalTop,
      fill: DISCRETIONARY,
      cornerRadius: [3, 3, 0, 0]
    });
  }
}

const spendTrend = ma(spend, 6);
const incomeTrend = ma(income, 6);

[
  [incomeTrend, INCOME_LINE, 2.6],
  [spendTrend, DISCRETIONARY_LINE, 2.4]
].forEach(([arr, color, thickness]) => {
  nodes.push({
    type: 'path',
    x: 0,
    y: 0,
    width: W,
    height: H,
    viewBox: [0, 0, W, H],
    geometry: linePath(arr),
    stroke: {
      fill: color,
      thickness,
      align: 'center',
      cap: 'round',
      join: 'round'
    }
  });
});

if (mode === 'full') {
  const hover = N - 1;
  const hoverX = pointX(hover);
  const [m, d, inc] = data[hover];
  const total = m + d;
  const tooltipW = W < 360 ? 134 : 154;
  const tooltipX = Math.max(6, Math.min(W - tooltipW - 6, hoverX - tooltipW + 8));
  const tooltipY = Math.max(4, yScale(inc) + 10);

  nodes.push({
    type: 'line',
    x: hoverX,
    y: 0,
    width: 0.01,
    height: plotH,
    stroke: { fill: '#3D2E2244', thickness: 1, align: 'center', dashPattern: [4, 4] }
  });

  [
    [inc, INCOME_LINE],
    [m, MORTGAGE_LINE],
    [total, DISCRETIONARY_LINE]
  ].forEach(([value, color]) => {
    nodes.push({
      type: 'ellipse',
      x: hoverX - 4,
      y: yScale(value) - 4,
      width: 8,
      height: 8,
      fill: CARD,
      stroke: { fill: color, thickness: 2, align: 'center' }
    });
  });

  const rowGap = W < 360 ? 2 : 4;
  const font = W < 360 ? 8 : 10;
  nodes.push({
    type: 'frame',
    x: tooltipX,
    y: tooltipY,
    width: tooltipW,
    height: 'fit_content',
    layout: 'vertical',
    gap: rowGap,
    padding: W < 360 ? [8, 10] : [10, 12],
    cornerRadius: 12,
    fill: CARD,
    stroke: { fill: '#3D2E2220', thickness: 1 },
    effect: { type: 'shadow', shadowType: 'outer', offset: { x: 0, y: 10 }, blur: 24, spread: 0, color: '#3D2E2224' },
    children: [
      { type: 'text', content: 'May 2026', fill: TEXT, fontFamily: 'DM Sans', fontSize: font + 1, fontWeight: '700' },
      {
        type: 'text',
        content: 'Income  $' + inc.toLocaleString(),
        fill: INCOME_LINE,
        fontFamily: 'DM Sans',
        fontSize: font,
        fontWeight: '600'
      },
      {
        type: 'text',
        content: 'Mortgage  $' + m.toLocaleString(),
        fill: TEXT,
        fontFamily: 'DM Sans',
        fontSize: font,
        fontWeight: '600'
      },
      {
        type: 'text',
        content: 'Discretionary  $' + d.toLocaleString(),
        fill: DISCRETIONARY_LINE,
        fontFamily: 'DM Sans',
        fontSize: font,
        fontWeight: '600'
      },
      {
        type: 'text',
        content: 'Spend  $' + total.toLocaleString(),
        fill: MUTED,
        fontFamily: 'DM Sans',
        fontSize: font,
        fontWeight: '600'
      }
    ]
  });
}

return nodes;
