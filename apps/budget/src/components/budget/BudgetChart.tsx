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
  formatCurrency,
  formatDateLabel
} from '@/lib/budget';

const MARGIN = { top: 20, right: 30, bottom: 80, left: 80 };
const MA_WINDOW = 6;
const CHART_WIDTH = 1200;
const CHART_HEIGHT = 520;

interface BudgetChartProps {
  data: Array<BudgetDataPoint>;
  period: TimePeriod;
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
      <div className="flex h-[340px] min-h-0 flex-col rounded-3xl bg-warm-bg-card-soft p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-warm-display text-warm-text-primary">
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
    padding: 0.1
  });

  const maxVal = Math.max(
    ...filtered.map((d) => Math.max(d.spend, d.sinkOrSwim))
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

  // Show every Nth label to prevent overlap
  const labelInterval = Math.max(1, Math.ceil(filtered.length / 20));

  if (innerWidth <= 0 || innerHeight <= 0) return null;

  return (
    <div className="flex h-[340px] min-h-0 flex-col rounded-3xl bg-warm-bg-card-soft p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-warm-display text-warm-text-primary">
          Income vs Spending
        </h2>
        <div className="flex items-center gap-4 text-xs text-warm-text-secondary">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: '#D85A36' }}
            />
            Spend
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: '#5F9466' }}
            />
            Sink or Swim
          </div>
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
              tickFormat={(date) => formatDateLabel(date)}
              tickValues={filtered
                .map((d) => d.date)
                .filter((_, i) => i % labelInterval === 0)}
              tickLabelProps={() => ({
                fill: '#7C6755',
                fontSize: 11,
                textAnchor: 'end',
                dy: '0.25em',
                dx: '-0.5em',
                angle: -45
              })}
              stroke="#EFE3D2"
              tickStroke="#EFE3D2"
              hideTicks={false}
            />

            <AxisLeft
              scale={yScale}
              tickFormat={(v) => formatCurrency(v as number)}
              tickLabelProps={() => ({
                fill: '#7C6755',
                fontSize: 11,
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
