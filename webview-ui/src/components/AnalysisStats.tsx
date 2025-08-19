import React from 'react';
import { Grid, Card, StatsCard } from 'tabler-react';

interface AnalysisStatsProps {
  // TODO: Add props for real data
  paragraphCount?: number;
  charCount?: number;
  overLimitCount?: number;
  underLimitCount?: number;
}

const AnalysisStats: React.FC<AnalysisStatsProps> = ({
  paragraphCount = 0,
  charCount = 0,
  overLimitCount = 0,
  underLimitCount = 0,
}) => {
  return (
    <Card>
      <Card.Header>
        <Card.Title>段落分析</Card.Title>
      </Card.Header>
      <Card.Body>
        <Grid.Row>
          <Grid.Col sm={6} lg={3}>
            <StatsCard
              layout={1}
              movement={0}
              total={paragraphCount}
              label="総段落数"
            />
          </Grid.Col>
          <Grid.Col sm={6} lg={3}>
            <StatsCard
              layout={1}
              movement={0}
              total={charCount}
              label="総文字数"
            />
          </Grid.Col>
          <Grid.Col sm={6} lg={3}>
            <StatsCard
              layout={1}
              movement={overLimitCount > 0 ? 1 : 0} // Example of showing movement indicator
              total={overLimitCount}
              label="文字数超過"
              movementColor="red"
            />
          </Grid.Col>
          <Grid.Col sm={6} lg={3}>
            <StatsCard
              layout={1}
              movement={underLimitCount > 0 ? -1 : 0} // Example of showing movement indicator
              total={underLimitCount}
              label="文字数不足"
              movementColor="orange"
            />
          </Grid.Col>
        </Grid.Row>
      </Card.Body>
    </Card>
  );
};

export default AnalysisStats;
