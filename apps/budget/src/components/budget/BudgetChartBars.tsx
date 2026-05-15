import { Bar } from '@visx/shape';
import type { ScaleBand, ScaleLinear } from 'd3-scale';
import type { BudgetDataPoint } from '@/lib/budget';

interface BudgetChartBarsProps {
  data: Array<BudgetDataPoint>;
  xScale: ScaleBand<number>;
  yScale: ScaleLinear<number, number>;
  height: number;
  onMouseMove: (
    event: React.MouseEvent<SVGRectElement>,
    datum: BudgetDataPoint
  ) => void;
  onMouseLeave: () => void;
}

export default function BudgetChartBars({
  data,
  xScale,
  yScale,
  height,
  onMouseMove,
  onMouseLeave
}: BudgetChartBarsProps) {
  const bandwidth = xScale.bandwidth();

  return (
    <>
      {/* Sink or Swim bars — behind */}
      {data.map((d) => {
        const x = xScale(d.date);
        if (x === undefined) return null;
        const barHeight = height - yScale(d.sinkOrSwim);
        const y = yScale(d.sinkOrSwim);
        return (
          <Bar
            key={`sos-${d.date}`}
            x={x}
            y={y}
            width={bandwidth}
            height={Math.max(0, barHeight)}
            fill="rgba(100, 149, 237, 0.5)"
            onMouseMove={(e) =>
              onMouseMove(e as React.MouseEvent<SVGRectElement>, d)
            }
            onMouseLeave={onMouseLeave}
          />
        );
      })}

      {/* Spend bars — in front */}
      {data.map((d) => {
        const x = xScale(d.date);
        if (x === undefined) return null;
        const barHeight = height - yScale(d.spend);
        const y = yScale(d.spend);
        return (
          <Bar
            key={`spend-${d.date}`}
            x={x}
            y={y}
            width={bandwidth}
            height={Math.max(0, barHeight)}
            fill="rgba(250, 128, 114, 0.5)"
            onMouseMove={(e) =>
              onMouseMove(e as React.MouseEvent<SVGRectElement>, d)
            }
            onMouseLeave={onMouseLeave}
          />
        );
      })}
    </>
  );
}
