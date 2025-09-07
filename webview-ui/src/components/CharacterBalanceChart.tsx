import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

interface ChartData {
  name: string;
  value: number;
}

interface CharacterBalanceChartProps {
  data: ChartData[];
}

// Colors from the COLOR_CHART.html for categorical data
const COLORS = ['#0072B2', '#009E73', '#E69F00', '#56B4E9'];

const CharacterBalanceChart: React.FC<CharacterBalanceChartProps> = ({ data }) => {
  // Filter out items with no value to avoid rendering empty slices
  const chartData = data.filter(item => item.value > 0);

  if (!chartData.length) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        color: '#4D4D4D', // Text Secondary from color chart
        backgroundColor: '#F7F7F7' // Surface from color chart
      }}>
        No Data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Tooltip formatter={(value: number) => `${(value * 100).toFixed(1)}%`} />
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius="80%"
          fill="#8884d8"
          dataKey="value"
          isAnimationActive={false} // Disable animation for performance
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
};

export default CharacterBalanceChart;
