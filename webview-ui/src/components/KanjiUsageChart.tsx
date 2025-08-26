import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface KanjiUsageData {
  name: '常用漢字' | '非常用漢字';
  value: number;
}

type KanjiUsageChartProps = {
  data: KanjiUsageData[];
  width?: number;
  height?: number;
};

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

  const emptyStyle: React.CSSProperties = width && height
    ? { width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-descriptionForeground)' }
    : { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-descriptionForeground)' };

  if (totalValue === 0) {
    return <div style={emptyStyle}>-</div>;
  }

  const ChartBody = (
    <PieChart>
      <Pie
        data={data}
        cx="50%"
        cy="50%"
        innerRadius={40}
        outerRadius={80}
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

  if (width && height) {
    return (
      <div style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          {ChartBody}
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      {ChartBody}
    </ResponsiveContainer>
  );
};

export default KanjiUsageChart;
