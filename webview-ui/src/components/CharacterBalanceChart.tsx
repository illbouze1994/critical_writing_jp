import React from 'react';
import { PieChart, Pie, Cell, Tooltip } from 'recharts';

export interface CharBalanceData {
  name: 'ひらがな' | 'カタカナ' | '漢字' | '英数字' | 'その他';
  value: number;
}

interface CharacterBalanceChartProps {
  data: CharBalanceData[];
  width: number;
  height: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#96CEB4'];

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

const CharacterBalanceChart: React.FC<CharacterBalanceChartProps> = ({ data, width, height }) => {
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

const CharacterBalanceChart: React.FC<CharacterBalanceChartProps> = ({ data }) => {
  // If there's no data or only zero values, don't render the chart
  const totalValue = data.reduce((sum, entry) => sum + entry.value, 0);
  if (totalValue === 0) {
    return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--vscode-descriptionForeground)' }}>-</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
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
        <Tooltip content={<CustomTooltip />} />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default CharacterBalanceChart;
