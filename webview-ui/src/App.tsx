import React, { useState, useEffect } from 'react';
import AnalysisStats from './components/AnalysisStats';
import ParagraphDashboard from './components/ParagraphDashboard';

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
    <div className="page">
        <div className="page-main">
            <div className="page-header d-print-none">
                <div className="container-xl">
                    <div className="row g-2 align-items-center">
                        <div className="col">
                            {/* Page title removed for cleaner section-based titles */}
                        </div>
                        <div className="col-auto ms-auto d-print-none">
                            <button onClick={handleToggleHighlight} className={`btn ${highlighting ? 'btn-primary' : 'btn-secondary'}`}>
                                キーワードハイライト: {highlighting ? 'ON' : 'OFF'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            <div className="page-body">
                <div className="container-xl">
                    {analysisData && analysisData.hasContent ? (
                        <div className="row row-deck row-cards">
                            <div className="col-12">
                                <AnalysisStats
                                    paragraphCount={analysisData.summary.totalParagraphs}
                                    charCount={analysisData.summary.totalChars}
                                    overLimitCount={analysisData.summary.overCount}
                                    underLimitCount={analysisData.summary.underCount}
                                />
                            </div>
                            <div className="col-12">
                                <div className="page-header mt-4">
                                    <h2 className="page-title">段落プレビューと並び替え</h2>
                                </div>
                                <ParagraphDashboard paragraphs={analysisData.paragraphs} />
                            </div>
                        </div>
                    ) : (
                        <div className="card">
                            <div className="card-body">
                                <p>{analysisData ? analysisData.message : '解析対象のファイルを開いてください。'}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
};

export default App;
