import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { useTooltip } from '@visx/tooltip';

import BudgetChartBars from './BudgetChartBars';
import BudgetChartLines from './BudgetChartLines';
import BudgetChartTooltip from './BudgetChartTooltip';
import type { BudgetDataPoint, TimePeriod } from '@/lib/budget';
import {
  computeMovingAverage,
  filterByTimePeriod,
  formatCurrency
} from '@/lib/budget';

const MARGIN = { top: 20, right: 28, bottom: 72, left: 68 };
const MA_WINDOW = 6;
const CHART_WIDTH = 1200;
const CHART_HEIGHT = 600;

interface BudgetChartProps {
  data: Array<BudgetDataPoint>;
  period: TimePeriod;
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2.5 w-2.5 rounded-[3px]"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function BudgetChartInner({
  data,
  period,
  width,
  height
}: BudgetChartProps & { width: number; height: number }) {
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip
  } = useTooltip<BudgetDataPoint>();

  const filtered = filterByTimePeriod(data, period);

  if (filtered.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-warm-bg-card-soft border border-warm-border p-5 md:p-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[20px] leading-tight font-warm-display text-warm-text-primary tracking-[-0.3px]">
            Income vs Spending
          </h2>
        </div>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 text-center text-warm-text-secondary">
          <p className="text-sm font-medium">No budget data</p>
          <p className="text-sm text-warm-text-tertiary">
            Seed the budget table to render the chart.
          </p>
        </div>
      </div>
    );
  }

  const innerWidth = width - MARGIN.left - MARGIN.right;
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const xScale = scaleBand<number>({
    domain: filtered.map((d) => d.date),
    range: [0, innerWidth],
    padding: 0.04
  });

  const maxVal = Math.max(
    ...filtered.map((d) => Math.max(d.sinkOrSwim, d.spend + d.mortgage))
  );

  const yScale = scaleLinear<number>({
    domain: [0, maxVal * 1.1],
    range: [innerHeight, 0],
    nice: true
  });

  const spendMA = computeMovingAverage(
    filtered.map((d) => d.spend),
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

  const handleMouseMove = (
    event: React.MouseEvent<SVGRectElement>,
    datum: BudgetDataPoint
  ) => {
    const svgRect = event.currentTarget.closest('svg')?.getBoundingClientRect();
    if (!svgRect) return;
    showTooltip({
      tooltipData: datum,
      tooltipLeft: event.clientX - svgRect.left,
      tooltipTop: event.clientY - svgRect.top
    });
  };

  const tickCount = Math.min(6, filtered.length);
  const tickValues =
    tickCount <= 1
      ? filtered.map((d) => d.date)
      : Array.from({ length: tickCount }, (_, i) => {
          const idx = Math.round((i * (filtered.length - 1)) / (tickCount - 1));
          return filtered[idx].date;
        });

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-3xl bg-warm-bg-card-soft border border-warm-border p-5 md:p-6">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-[20px] leading-tight font-warm-display text-warm-text-primary tracking-[-0.3px]">
          Income vs Spending
        </h2>
        <div className="flex items-center gap-3.5 text-[11px] font-medium text-warm-text-secondary">
          <LegendDot color="#3D2E22" label="Mortgage" />
          <LegendDot color="#D85A36" label="Discretionary" />
          <LegendDot color="#5F9466" label="Income" />
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          className="h-full w-full"
        >
          <Group left={MARGIN.left} top={MARGIN.top}>
            <GridRows
              scale={yScale}
              width={innerWidth}
              stroke="#EFE3D2"
              strokeOpacity={0.6}
            />

            <BudgetChartBars
              data={filtered}
              xScale={xScale}
              yScale={yScale}
              height={innerHeight}
              onMouseMove={handleMouseMove}
              onMouseLeave={hideTooltip}
            />

            <BudgetChartLines
              spendTrend={spendTrend}
              sinkOrSwimTrend={sinkOrSwimTrend}
              xScale={xScale}
              yScale={yScale}
            />

            <AxisBottom
              top={innerHeight}
              scale={xScale}
              tickFormat={(date) =>
                new Date(date).toLocaleString('en-AU', { month: 'short' })
              }
              tickValues={tickValues}
              tickLabelProps={() => ({
                fill: '#B5A595',
                fontSize: 10,
                fontWeight: 500,
                textAnchor: 'middle',
                dy: '0.75em'
              })}
              stroke="#EFE3D2"
              tickStroke="#EFE3D2"
              hideTicks
            />

            <AxisLeft
              scale={yScale}
              tickFormat={(v) => formatCurrency(v as number)}
              tickLabelProps={() => ({
                fill: '#B5A595',
                fontSize: 10,
                fontWeight: 500,
                textAnchor: 'end',
                dx: '-0.5em',
                dy: '0.33em'
              })}
              stroke="#EFE3D2"
              tickStroke="#EFE3D2"
              numTicks={6}
            />
          </Group>
        </svg>

        {tooltipOpen && tooltipData && (
          <BudgetChartTooltip
            date={tooltipData.date}
            spend={tooltipData.spend}
            sinkOrSwim={tooltipData.sinkOrSwim}
            top={tooltipTop ?? 0}
            left={tooltipLeft ?? 0}
          />
        )}
      </div>
    </div>
  );
}

export default function BudgetChart({ data, period }: BudgetChartProps) {
  return (
    <BudgetChartInner
      data={data}
      period={period}
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
    />
  );
}
