import { LinePath } from '@visx/shape';
import { curveMonotoneX } from 'd3-shape';
import type { ScaleBand, ScaleLinear } from 'd3-scale';

interface TrendPoint {
  date: number;
  value: number;
}

interface BudgetChartLinesProps {
  spendTrend: Array<TrendPoint>;
  sinkOrSwimTrend: Array<TrendPoint>;
  xScale: ScaleBand<number>;
  yScale: ScaleLinear<number, number>;
}

export default function BudgetChartLines({
  spendTrend,
  sinkOrSwimTrend,
  xScale,
  yScale
}: BudgetChartLinesProps) {
  const halfBand = xScale.bandwidth() / 2;

  return (
    <>
      <LinePath
        data={sinkOrSwimTrend}
        x={(d) => (xScale(d.date) ?? 0) + halfBand}
        y={(d) => yScale(d.value)}
        stroke="#5F9466"
        strokeWidth={2}
        curve={curveMonotoneX}
      />
      <LinePath
        data={spendTrend}
        x={(d) => (xScale(d.date) ?? 0) + halfBand}
        y={(d) => yScale(d.value)}
        stroke="#D85A36"
        strokeWidth={2}
        curve={curveMonotoneX}
      />
    </>
  );
}
