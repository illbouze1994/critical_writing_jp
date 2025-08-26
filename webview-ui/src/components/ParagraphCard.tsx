import React from 'react';
import CharacterBalanceChart, { CharBalanceData } from './CharacterBalanceChart';
import KanjiUsageChart, { KanjiUsageData } from './KanjiUsageChart';
import { IconGripVertical } from '@tabler/icons-react';
import { DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export interface ParagraphData {
  id: string;
  content: string;
  charCount: number;
  charBalance: CharBalanceData[];
  kanjiUsage: KanjiUsageData[];
}

interface ParagraphCardProps {
  paragraph: ParagraphData;
  attributes?: DraggableAttributes;
  listeners?: SyntheticListenerMap;
}

const ParagraphCard: React.FC<ParagraphCardProps> = ({ paragraph, attributes, listeners }) => {
  return (
    <div className="card" title={paragraph.content} {...attributes}>
      <div className="card-body">
        <div className="row align-items-center">
          <div className="col-auto" style={{ cursor: 'grab' }} {...listeners}>
            <IconGripVertical size={24} className="text-secondary" />
          </div>
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
                  <CharacterBalanceChart data={paragraph.charBalance} width={80} height={80} />
                  <KanjiUsageChart data={paragraph.kanjiUsage} width={80} height={80} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParagraphCard;
