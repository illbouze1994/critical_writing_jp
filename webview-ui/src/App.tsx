import React, { useState, useEffect } from 'react';
import { Page, Grid, Card, Text, Button } from 'tabler-react';
import "tabler-react/dist/Tabler.css";

// TODO: 後で本物のコンポーネントに置き換える
// import CharacterBalancePanel from './components/CharacterBalancePanel';
// import KanjiUsagePanel from './components/KanjiUsagePanel';
// import RoiMapPanel from './components/RoiMapPanel';
// import ResultsTable from './components/ResultsTable';
import AnalysisStats from './components/AnalysisStats';
import CharacterBalanceChart from './components/CharacterBalanceChart';
import KanjiUsageChart from './components/KanjiUsageChart';
import ParagraphDashboard from './components/ParagraphDashboard';

// Create a component that will apply global styles
const GlobalStyle = () => {
  return (
    <style>
      {`
        body {
          font-family: 'Noto Sans JP', sans-serif;
        }
      `}
    </style>
  );
};

const App = () => {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [highlighting, setHighlighting] = useState(true); // Assume ON by default

  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : { postMessage: () => {} };

  const handleToggleHighlight = () => {
    const newState = !highlighting;
    setHighlighting(newState);
    vscode.postMessage({
      type: 'toggleKeywordHighlight',
      enabled: newState,
    });
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.type === 'update') {
        console.log('Received update:', message.payload);
        setAnalysisData(message.payload);
      } else if (message.type === 'keywordHighlightChanged') {
        setHighlighting(message.enabled);
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <Page>
      <GlobalStyle />
      <Page.Main>
        <Page.Header
          title="文書解析結果"
          actions={
            <Button onClick={handleToggleHighlight} color={highlighting ? "primary" : "secondary"}>
              キーワードハイライト: {highlighting ? 'ON' : 'OFF'}
            </Button>
          }
        />
        {analysisData && analysisData.hasContent ? (
          <Grid.Row cards>
            <Grid.Col width={12}>
              <AnalysisStats
                paragraphCount={analysisData.summary.totalParagraphs}
                charCount={analysisData.summary.totalChars}
                overLimitCount={analysisData.summary.overCount}
                underLimitCount={analysisData.summary.underCount}
              />
            </Grid.Col>

            <Grid.Col width={12}>
              <ParagraphDashboard paragraphs={analysisData.paragraphs} />
            </Grid.Col>
          </Grid.Row>
        ) : (
          <Text>{analysisData ? analysisData.message : '解析対象のファイルを開いてください。'}</Text>
        )}
      </Page.Main>
    </Page>
  );
};

export default App;
