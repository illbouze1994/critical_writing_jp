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
  <div className="card">
    <div className="card-body p-2 text-center">
      <div className="text-secondary mb-1">{label}</div>
      <div className={`fw-bold h2 mb-0 ${isDanger ? 'text-red' : ''} ${isWarning ? 'text-orange' : ''}`}>
        {value}
      </div>
    </div>
  </div>
);

const AnalysisStats: React.FC<AnalysisStatsProps> = ({
  paragraphCount = 0,
  charCount = 0,
  overLimitCount = 0,
  underLimitCount = 0,
}) => {
  return (
    <div className="card">
        <div className="card-header">
            <h3 className="card-title">段落分析</h3>
        </div>
        <div className="card-body">
            <div className="row row-cards">
                <div className="col-sm-6 col-lg-3">
                <StatCard value={paragraphCount} label="総段落数" />
                </div>
                <div className="col-sm-6 col-lg-3">
                <StatCard value={charCount} label="総文字数" />
                </div>
                <div className="col-sm-6 col-lg-3">
                <StatCard value={overLimitCount} label="文字数超過" isDanger={overLimitCount > 0} />
                </div>
                <div className="col-sm-6 col-lg-3">
                <StatCard value={underLimitCount} label="文字数不足" isWarning={underLimitCount > 0} />
                </div>
            </div>
        </div>
    </div>
  );
};

export default AnalysisStats;
