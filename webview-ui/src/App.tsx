import React, { useState, useEffect } from 'react';
import AnalysisStats from './components/AnalysisStats';
import ParagraphDashboard from './components/ParagraphDashboard';
import vscodeApi from './vscodeApi';

const App = () => {
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [highlighting, setHighlighting] = useState(true); // Assume ON by default

  const handleToggleHighlight = () => {
    const newState = !highlighting;
    setHighlighting(newState);
    vscodeApi.postMessage({
      type: 'toggleKeywordHighlight',
      enabled: newState,
    });
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      // The message from the extension is now of type PanelUpdate
      if (message.type === 'panel/update') {
        console.log('Received panel/update:', message.payload);
        setAnalysisData(message.payload);
      } else if (message.type === 'keywordHighlightChanged') {
        setHighlighting(message.enabled);
      }
    };

    window.addEventListener('message', handleMessage);

    // Listen for font-family from the extension
    const fontFamily = getComputedStyle(document.documentElement).getPropertyValue('--vscode-font-family');
    if (fontFamily) {
      document.body.style.fontFamily = fontFamily;
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div className="app-container">
      <header>
        <h1>文書解析結果</h1>
        <button onClick={handleToggleHighlight} className={`button ${highlighting ? '' : 'secondary'}`}>
          キーワードハイライト: {highlighting ? 'ON' : 'OFF'}
        </button>
      </header>

      {analysisData ? (
        <>
          <section className="section">
            <h2 className="section-title">全体サマリー</h2>
            <AnalysisStats
              paragraphCount={analysisData.summary.total}
              overLimitCount={analysisData.summary.over}
              underLimitCount={analysisData.summary.under}
            />
          </section>

          <section className="section">
            <h2 className="section-title">段落プレビューと並び替え</h2>
            <ParagraphDashboard paragraphs={analysisData.rows} />
          </section>
        </>
      ) : (
        <div className="section">
          <p>解析対象のファイルを開いてください。</p>
        </div>
      )}
    </div>
  );
};

export default App;
