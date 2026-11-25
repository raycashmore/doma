import { Bar } from '@visx/shape';
import type { ScaleBand, ScaleLinear } from 'd3-scale';
import type { ChartMonth } from '@repo/convex/spendingModel';

type BudgetChartBarsProps = {
  data: Array<ChartMonth>;
  xScale: ScaleBand<number>;
  yScale: ScaleLinear<number, number>;
  height: number;
  onMouseMove: (event: React.MouseEvent<SVGRectElement>, datum: ChartMonth) => void;
  onMouseLeave: () => void;
  onBarClick?: (date: number) => void;
};

const INCOME_FILL = '#5F946666';
const MORTGAGE_FILL = '#3D2E227A';
const DISCRETIONARY_FILL = '#D85A3670';

export function BudgetChartBars({
  data,
  xScale,
  yScale,
  height,
  onMouseMove,
  onMouseLeave,
  onBarClick
}: BudgetChartBarsProps) {
  const bandwidth = xScale.bandwidth();
  const incomeWidth = bandwidth * 0.78;
  const spendWidth = bandwidth * 0.52;

  return (
    <>
      {/* Income — wide background bar, sage @ 40% */}
      {data.map((d) => {
        const x = xScale(d.date);
        if (x === undefined) return null;
        const y = yScale(d.income);
        return (
          <Bar
            key={`income-${d.date}`}
            x={x + (bandwidth - incomeWidth) / 2}
            y={y}
            width={incomeWidth}
            height={Math.max(0, height - y)}
            fill={INCOME_FILL}
            rx={4}
            style={onBarClick ? { cursor: 'pointer' } : undefined}
            onClick={() => onBarClick?.(d.date)}
            onMouseMove={(e) => onMouseMove(e, d)}
            onMouseLeave={onMouseLeave}
          />
        );
      })}

      {/* Mortgage — narrow base layer */}
      {data.map((d) => {
        const x = xScale(d.date);
        if (x === undefined) return null;
        const y = yScale(d.mortgage);
        return (
          <Bar
            key={`mortgage-${d.date}`}
            x={x + (bandwidth - spendWidth) / 2}
            y={y}
            width={spendWidth}
            height={Math.max(0, height - y)}
            fill={MORTGAGE_FILL}
            rx={3}
            style={onBarClick ? { cursor: 'pointer' } : undefined}
            onClick={() => onBarClick?.(d.date)}
            onMouseMove={(e) => onMouseMove(e, d)}
            onMouseLeave={onMouseLeave}
          />
        );
      })}

      {/* Spend before the mortgage, stacked on top of it: tops out at total spend */}
      {data.map((d) => {
        const x = xScale(d.date);
        if (x === undefined) return null;
        const yTop = yScale(d.spend);
        const yMortgageTop = yScale(d.mortgage);
        return (
          <Bar
            key={`disc-${d.date}`}
            x={x + (bandwidth - spendWidth) / 2}
            y={yTop}
            width={spendWidth}
            height={Math.max(0, yMortgageTop - yTop)}
            fill={DISCRETIONARY_FILL}
            rx={3}
            style={onBarClick ? { cursor: 'pointer' } : undefined}
            onClick={() => onBarClick?.(d.date)}
            onMouseMove={(e) => onMouseMove(e, d)}
            onMouseLeave={onMouseLeave}
          />
        );
      })}
    </>
  );
}
