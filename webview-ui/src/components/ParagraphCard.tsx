import React from 'react';
import CharacterBalanceChart, { CharBalanceData } from './CharacterBalanceChart';
import KanjiUsageChart, { KanjiUsageData } from './KanjiUsageChart';

export interface ParagraphData {
  id: string;
  content: string;
  charCount: number;
  charBalance: CharBalanceData[];
  kanjiUsage: KanjiUsageData[];
}

interface ParagraphCardProps {
  paragraph: ParagraphData;
}

const ParagraphCard: React.FC<ParagraphCardProps> = ({ paragraph }) => {
  return (
    <div className="card" title={paragraph.content}>
      <div className="card-body">
        <div className="row align-items-center">
          <div className="col">
            <p className="text-secondary">{paragraph.content.substring(0, 120)}...</p>
          </div>
          <div className="col-auto">
            <div className="row align-items-center text-center">
              <div className="col-12">
                <div className="h1 mb-0">{paragraph.charCount}</div>
                <div className="text-secondary">文字</div>
              </div>
              <div className="col-12 d-flex justify-content-end mt-2">
                <div style={{ width: '80px', height: '80px' }}>
                  <CharacterBalanceChart data={paragraph.charBalance} height={80} />
                </div>
                <div style={{ width: '80px', height: '80px' }}>
                  <KanjiUsageChart data={paragraph.kanjiUsage} height={80} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParagraphCard;
