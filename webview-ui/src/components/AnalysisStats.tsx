import React from 'react';

interface AnalysisStatsProps {
  paragraphCount?: number;
  charCount?: number;
  overLimitCount?: number;
  underLimitCount?: number;
}

type StatCardProps = {
  value: number | string;
  label: string;
  isWarning?: boolean;
  isDanger?: boolean;
};

const StatCard: React.FC<StatCardProps> = ({ value, label, isWarning = false, isDanger = false }) => (
  <div className={`stat-card ${isDanger ? 'is-danger' : ''} ${isWarning ? 'is-warning' : ''}`}>
    <div className="value">{value}</div>
    <div className="label">{label}</div>
  </div>
);

const AnalysisStats: React.FC<AnalysisStatsProps> = ({
  paragraphCount = 0,
  overLimitCount = 0,
  underLimitCount = 0,
}) => {
  return (
    <div className="stats-grid">
      <StatCard value={paragraphCount} label="総段落数" />
      <StatCard value={overLimitCount} label="文字数超過" isDanger={overLimitCount > 0} />
      <StatCard value={underLimitCount} label="文字数不足" isWarning={underLimitCount > 0} />
    </div>
  );
};

export default AnalysisStats;
