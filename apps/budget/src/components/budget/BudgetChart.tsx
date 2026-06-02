import { Group } from '@visx/group';
import { ParentSize } from '@visx/responsive';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { useTooltip } from '@visx/tooltip';

import BudgetChartBars from './BudgetChartBars';
import BudgetChartLines from './BudgetChartLines';
import BudgetChartTooltip from './BudgetChartTooltip';
import type { BudgetDataPoint, TimePeriod } from '@/lib/budget';
import { computeMovingAverage, filterByTimePeriod, formatCurrency } from '@/lib/budget';

const BASE_MARGIN = { top: 14, right: 16, bottom: 28, left: 66 };
const COMPACT_MARGIN = { top: 14, right: 8, bottom: 28, left: 44 };
const MA_WINDOW = 6;
const AXIS_FONT_SIZE = 11;
const COMPACT_AXIS_WIDTH = 420;
const PARENT_SIZE_STYLES = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%'
} satisfies React.CSSProperties;
export const BUDGET_CHART_CARD_CLASS =
  'flex min-h-[16rem] min-w-0 flex-1 flex-col rounded-3xl bg-warm-bg-card-soft border border-warm-border p-5 lg:min-h-0 md:p-6';

type BudgetChartProps = {
  data: Array<BudgetDataPoint>;
  period: TimePeriod;
  onBarClick?: (date: number) => void;
};

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-[3px]" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

export function getBudgetChartLayout(width: number, height: number) {
  const margin = width < COMPACT_AXIS_WIDTH ? COMPACT_MARGIN : BASE_MARGIN;

  return {
    margin,
    innerWidth: width - margin.left - margin.right,
    innerHeight: height - margin.top - margin.bottom,
    compactYAxis: width < COMPACT_AXIS_WIDTH
  };
}

export function formatYAxisTick(cents: number, compact: boolean) {
  if (!compact) return formatCurrency(cents);

  const dollars = Math.round(cents / 100);
  const sign = dollars < 0 ? '-' : '';
  const absolute = Math.abs(dollars);

  if (absolute < 1000) return formatCurrency(cents);
  if (absolute < 1_000_000) return `${sign}$${Math.round(absolute / 1000)}k`;

  const millions = absolute / 1_000_000;
  const value = millions >= 10 ? Math.round(millions).toString() : millions.toFixed(1).replace(/\.0$/, '');
  return `${sign}$${value}m`;
}

function ChartHeader() {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <h2 className="text-[20px] leading-tight font-warm-display text-warm-text-primary tracking-[-0.3px]">
        Income vs Spending
      </h2>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] font-medium text-warm-text-secondary">
        <LegendDot color="#5F9466" label="Income" />
        <LegendDot color="#D85A36" label="Spend" />
        <LegendDot color="#3D2E22" label="Mortgage" />
      </div>
    </div>
  );
}

function BudgetChartSvg({
  data,
  period,
  width,
  height,
  onBarClick
}: BudgetChartProps & { width: number; height: number }) {
  const { tooltipData, tooltipLeft, tooltipTop, tooltipOpen, showTooltip, hideTooltip } = useTooltip<BudgetDataPoint>();

  const filtered = filterByTimePeriod(data, period);

  const { margin, innerWidth, innerHeight, compactYAxis } = getBudgetChartLayout(width, height);

  if (filtered.length === 0 || innerWidth <= 0 || innerHeight <= 0) return null;

  const xScale = scaleBand<number>({
    domain: filtered.map((d) => d.date),
    range: [0, innerWidth],
    padding: 0.04
  });

  const maxVal = Math.max(...filtered.map((d) => Math.max(d.sinkOrSwim, d.spend + d.mortgage)));

  const yScale = scaleLinear<number>({
    domain: [0, maxVal * 1.1],
    range: [innerHeight, 0],
    nice: true
  });

  const spendMA = computeMovingAverage(
    filtered.map((d) => d.spend + d.mortgage),
    MA_WINDOW
  );
  const sosMA = computeMovingAverage(
    filtered.map((d) => d.sinkOrSwim),
    MA_WINDOW
  );

  const spendTrend = filtered.map((d, i) => ({
    date: d.date,
    value: spendMA[i]
  }));
  const sinkOrSwimTrend = filtered.map((d, i) => ({
    date: d.date,
    value: sosMA[i]
  }));

  const handleMouseMove = (event: React.MouseEvent<SVGRectElement>, datum: BudgetDataPoint) => {
    const svgRect = event.currentTarget.closest('svg')?.getBoundingClientRect();
    if (!svgRect) return;
    showTooltip({
      tooltipData: datum,
      tooltipLeft: event.clientX - svgRect.left,
      tooltipTop: event.clientY - svgRect.top
    });
  };

  const tickCount = filtered.length <= 12 ? filtered.length : 12;
  const tickValues =
    tickCount === filtered.length
      ? filtered.map((d) => d.date)
      : Array.from({ length: tickCount }, (_, i) => {
          const idx = Math.round((i * (filtered.length - 1)) / (tickCount - 1));
          return filtered[idx].date;
        });

  return (
    <>
      <svg width={width} height={height} className="block">
        <Group left={margin.left} top={margin.top}>
          <GridRows scale={yScale} width={innerWidth} stroke="#EFE3D2" strokeOpacity={0.6} />

          <BudgetChartBars
            data={filtered}
            xScale={xScale}
            yScale={yScale}
            height={innerHeight}
            onMouseMove={handleMouseMove}
            onMouseLeave={hideTooltip}
            onBarClick={onBarClick}
          />

          <BudgetChartLines spendTrend={spendTrend} sinkOrSwimTrend={sinkOrSwimTrend} xScale={xScale} yScale={yScale} />

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            tickFormat={(date) => new Date(date).toLocaleString('en-AU', { month: 'short' })}
            tickValues={tickValues}
            tickLabelProps={() => ({
              fill: '#7C6755',
              fontSize: AXIS_FONT_SIZE,
              fontWeight: 500,
              fontFamily: 'DM Sans, system-ui, sans-serif',
              textAnchor: 'middle',
              dy: '0.6em'
            })}
            stroke="#EFE3D2"
            tickStroke="#EFE3D2"
            hideTicks
          />

          <AxisLeft
            scale={yScale}
            tickFormat={(v) => formatYAxisTick(v as number, compactYAxis)}
            tickLabelProps={() => ({
              fill: '#7C6755',
              fontSize: AXIS_FONT_SIZE,
              fontWeight: 500,
              fontFamily: 'DM Sans, system-ui, sans-serif',
              textAnchor: 'end',
              dx: '-0.4em',
              dy: '0.32em'
            })}
            stroke="#EFE3D2"
            tickStroke="#EFE3D2"
            numTicks={5}
            hideAxisLine
          />
        </Group>
      </svg>

      {tooltipOpen && tooltipData && (
        <BudgetChartTooltip
          date={tooltipData.date}
          spend={tooltipData.spend}
          sinkOrSwim={tooltipData.sinkOrSwim}
          mortgage={tooltipData.mortgage}
          top={tooltipTop ?? 0}
          left={tooltipLeft ?? 0}
        />
      )}
    </>
  );
}

export default function BudgetChart({ data, period, onBarClick }: BudgetChartProps) {
  const filtered = filterByTimePeriod(data, period);
  const isEmpty = filtered.length === 0;

  return (
    <div className={BUDGET_CHART_CARD_CLASS}>
      <ChartHeader />
      <div className="relative min-h-0 flex-1">
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-warm-text-secondary">
            <p className="text-sm font-medium">No budget data</p>
            <p className="text-sm text-warm-text-tertiary">Seed the budget table to render the chart.</p>
          </div>
        ) : (
          <ParentSize debounceTime={50} parentSizeStyles={PARENT_SIZE_STYLES}>
            {({ width, height }) =>
              width > 0 && height > 0 ? (
                <BudgetChartSvg data={data} period={period} width={width} height={height} onBarClick={onBarClick} />
              ) : null
            }
          </ParentSize>
        )}
      </div>
    </div>
  );
}
