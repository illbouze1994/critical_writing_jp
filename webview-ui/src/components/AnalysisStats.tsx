import React from 'react';

interface AnalysisStatsProps {
  paragraphCount?: number;
  charCount?: number;
  overLimitCount?: number;
  underLimitCount?: number;
}

const StatCard = ({ value, label, isWarning = false, isDanger = false }) => (
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
    <>
      <div className="page-header">
        <h1 className="page-title">段落分析</h1>
      </div>
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
    </>
  );
};

export default AnalysisStats;
