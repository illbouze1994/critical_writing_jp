import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface CharBalanceData {
  name: 'ひらがな' | 'カタカナ' | '漢字' | '英数字' | 'その他';
  value: number;
}

interface CharacterBalanceChartProps {
  data: CharBalanceData[];
  height?: number;
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

const CharacterBalanceChart: React.FC<CharacterBalanceChartProps> = ({ data, height = 250 }) => {
  const isSmall = height < 100;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={!isSmall}
          innerRadius={isSmall ? 15 : 40}
          outerRadius={isSmall ? 30 : 80}
          fill="#8884d8"
          dataKey="value"
          // 小さい場合はラベルを非表示
          label={isSmall ? undefined : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
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
