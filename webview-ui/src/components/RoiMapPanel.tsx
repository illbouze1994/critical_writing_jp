import React from 'react';
import { Div, Text } from "atomize";

interface ROIWordData {
  word: string;
  score: number;
  frequency: number;
}

const RoiMapPanel = () => {
  // Sample ROI data for visualization
  const sampleROIData: ROIWordData[] = [
    { word: "分析", score: 0.95, frequency: 15 },
    { word: "研究", score: 0.87, frequency: 12 },
    { word: "結果", score: 0.82, frequency: 18 },
    { word: "考察", score: 0.78, frequency: 10 },
    { word: "検討", score: 0.73, frequency: 8 },
    { word: "評価", score: 0.69, frequency: 7 },
    { word: "効果", score: 0.65, frequency: 9 },
    { word: "問題", score: 0.61, frequency: 6 },
  ];

  // Generate word map visualization using CSS-based layout
  const renderWordMap = () => {
    return sampleROIData.map((item, index) => {
      const fontSize = Math.max(12, Math.min(32, item.score * 40));
      const opacity = 0.6 + (item.score * 0.4);
      const color = `hsl(${200 - item.score * 60}, 70%, 50%)`;
      
      return (
        <Div
          key={index}
          d="inline-block"
          m="0.5rem"
          style={{
            fontSize: `${fontSize}px`,
            opacity,
            color,
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.3s ease'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'scale(1.1)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'scale(1.0)';
          }}
          title={`ROI Score: ${item.score.toFixed(2)}, Frequency: ${item.frequency}`}
        >
          {item.word}
        </Div>
      );
    });
  };

  return (
    <Div>
      <Text tag="h2" textSize="title">
        関心マップ (ROI)
      </Text>
      <Div 
        bg="surface" 
        h="400px" 
        m={{ t: "1rem" }} 
        d="flex" 
        align="center" 
        justify="center"
        flexWrap="wrap"
        p="2rem"
        border="1px solid"
        borderColor="divider"
        rounded="md"
        style={{ overflow: 'auto' }}
      >
        {renderWordMap()}
      </Div>
    </Div>
  );
};

export default RoiMapPanel;
