import { useState } from 'react';
import { Group } from '@visx/group';
import { scaleBand, scaleLinear } from '@visx/scale';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { GridRows } from '@visx/grid';
import { useTooltip } from '@visx/tooltip';

import BudgetChartBars from './BudgetChartBars';
import BudgetChartLines from './BudgetChartLines';
import BudgetChartTooltip from './BudgetChartTooltip';
import BudgetChartFilters from './BudgetChartFilters';
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
}

function BudgetChartInner({
  data,
  width,
  height
}: BudgetChartProps & { width: number; height: number }) {
  const [period, setPeriod] = useState<TimePeriod>('ALL');

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
      <div className="flex min-h-[500px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium text-neutral-700">No budget data</p>
        <p className="text-sm text-neutral-500">
          Seed the budget table to render the chart.
        </p>
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
    <div className="relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-6 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'rgba(250, 128, 114, 0.7)' }}
            />
            Spend
          </div>
          <div className="flex items-center gap-2">
            <span
              className="inline-block w-3 h-3 rounded-sm"
              style={{ backgroundColor: 'rgba(100, 149, 237, 0.7)' }}
            />
            Sink or Swim
          </div>
        </div>
        <BudgetChartFilters selected={period} onChange={setPeriod} />
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-[28rem] min-w-[720px] w-full sm:h-[32rem]"
      >
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows
            scale={yScale}
            width={innerWidth}
            stroke="#e5e7eb"
            strokeOpacity={0.5}
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
              fill: '#6b7280',
              fontSize: 11,
              textAnchor: 'end',
              dy: '0.25em',
              dx: '-0.5em',
              angle: -45
            })}
            stroke="#d1d5db"
            tickStroke="#d1d5db"
            hideTicks={false}
          />

          <AxisLeft
            scale={yScale}
            tickFormat={(v) => formatCurrency(v as number)}
            tickLabelProps={() => ({
              fill: '#6b7280',
              fontSize: 11,
              textAnchor: 'end',
              dx: '-0.5em',
              dy: '0.33em'
            })}
            stroke="#d1d5db"
            tickStroke="#d1d5db"
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
  );
}

export default function BudgetChart({ data }: BudgetChartProps) {
  return <BudgetChartInner data={data} width={CHART_WIDTH} height={CHART_HEIGHT} />;
}
