import React from 'react';
import CharacterBalanceChart from './CharacterBalanceChart';
import KanjiUsageChart from './KanjiUsageChart';
import { DraggableAttributes } from '@dnd-kit/core';
import { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export interface ParagraphData {
  id: string;
  head: string;
  chars: number;
  features: {
    hiragana_ratio: number;
    katakana_ratio: number;
    kanji_ratio: number;
    alphanumeric_ratio: number;
    joyo_kanji_usage: number;
    [key: string]: any;
  };
  [key: string]: any;
}

interface ParagraphCardProps {
  paragraph: ParagraphData;
  attributes?: DraggableAttributes;
  listeners?: SyntheticListenerMap;
}

const ParagraphCard: React.FC<ParagraphCardProps> = ({ paragraph, attributes, listeners }) => {
  const charBalanceData = [
    { name: 'ひらがな', value: paragraph.features.hiragana_ratio },
    { name: 'カタカナ', value: paragraph.features.katakana_ratio },
    { name: '漢字', value: paragraph.features.kanji_ratio },
    { name: '英数字', value: paragraph.features.alphanumeric_ratio },
  ];

  const kanjiUsageData = [
    { name: '常用漢字', value: paragraph.features.joyo_kanji_usage },
    { name: 'その他', value: 1 - paragraph.features.joyo_kanji_usage },
  ];

  return (
    <div className="paragraph-card" title={paragraph.head} {...attributes}>
      <span className="drag-handle" {...listeners}>::</span>

      <div className="paragraph-content">
        {paragraph.head}
      </div>

      <div className="paragraph-meta">
        <div className="paragraph-chars">
          <div className="value">{paragraph.chars}</div>
          <div className="label">文字</div>
        </div>
        <div className="paragraph-charts">
          <div className="chart-container">
            <CharacterBalanceChart data={charBalanceData} />
          </div>
          <div className="chart-container">
            <KanjiUsageChart data={kanjiUsageData} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ParagraphCard;
