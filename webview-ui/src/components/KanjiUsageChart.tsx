import React from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

export interface KanjiUsageData {
  name: '常用漢字' | '非常用漢字';
  value: number;
}

interface KanjiUsageChartProps {
  data: KanjiUsageData[];
  width: number;
  height: number;
}

const COLORS = ['#00C49F', '#FF8042'];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip" style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', padding: '5px', border: '1px solid #ccc' }}>
        <p className="label">{`${payload[0].name} : ${payload[0].value}`}</p>
      </div>
    );
  }
  return null;
};

const KanjiUsageChart: React.FC<KanjiUsageChartProps> = ({ data, width, height }) => {
  const totalValue = data.reduce((sum, entry) => sum + entry.value, 0);
  if (totalValue === 0) {
    return <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-descriptionForeground)' }}>-</div>;
  }

  return (
    <PieChart width={width} height={height}>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        labelLine={false}
        innerRadius="50%"
        outerRadius="90%"
        fill="#8884d8"
        dataKey="value"
        label={false}
      >
        {data.map((entry, index) => (
          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
        ))}
      </Pie>
      <Tooltip content={<CustomTooltip />} wrapperStyle={{ zIndex: 1000 }} />
    </PieChart>
  );
};

export default KanjiUsageChart;
