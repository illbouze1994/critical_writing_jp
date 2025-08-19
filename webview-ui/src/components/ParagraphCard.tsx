import React from 'react';
import { Card, Grid, Text } from 'tabler-react';
import CharacterBalanceChart, { CharBalanceData } from './CharacterBalanceChart';
import KanjiUsageChart, { KanjiUsageData } from './KanjiUsageChart';

// 仮の段落データ構造
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
    <Card>
      <Card.Body>
        <Grid.Row alignItems="center">
          <Grid.Col>
            <Text wrap>{paragraph.content.substring(0, 100)}...</Text>
          </Grid.Col>
          <Grid.Col size="auto">
            <div style={{ textAlign: 'center' }}>
              <Text size="lg" strong>{paragraph.charCount}</Text>
              <Text muted>文字</Text>
            </div>
          </Grid.Col>
          <Grid.Col size="auto" style={{ width: '120px' }}>
            <CharacterBalanceChart data={paragraph.charBalance} height={80} />
          </Grid.Col>
          <Grid.Col size="auto" style={{ width: '120px' }}>
            <KanjiUsageChart data={paragraph.kanjiUsage} height={80} />
          </Grid.Col>
        </Grid.Row>
      </Card.Body>
    </Card>
  );
};

export default ParagraphCard;
