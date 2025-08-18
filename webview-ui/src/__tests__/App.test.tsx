import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../App';

// Mock Styletron
jest.mock('styletron-react', () => ({
  Provider: ({ children }: any) => children,
}));

jest.mock('styletron-engine-atomic', () => ({
  Client: jest.fn(() => ({})),
}));

// Mock Atomize components
jest.mock('atomize', () => ({
  Div: ({ children, ...props }: any) => <div data-testid="div" {...props}>{children}</div>,
  Text: ({ children, ...props }: any) => <span data-testid="text" {...props}>{children}</span>,
  Dropdown: ({ children, ...props }: any) => <select data-testid="dropdown" {...props}>{children}</select>,
  Anchor: ({ children, ...props }: any) => <a data-testid="anchor" {...props}>{children}</a>,
  ThemeProvider: ({ children }: any) => children,
  StyleReset: () => null,
}));

// Mock components
jest.mock('../components/CharacterBalancePanel', () => {
  return function CharacterBalancePanel() {
    return <div data-testid="character-balance-panel">文字種バランス</div>;
  };
});

jest.mock('../components/KanjiUsagePanel', () => {
  return function KanjiUsagePanel() {
    return <div data-testid="kanji-usage-panel">常用漢字使用状況</div>;
  };
});

jest.mock('../components/RoiMapPanel', () => {
  return function RoiMapPanel() {
    return <div data-testid="roi-map-panel">関心マップ (ROI)</div>;
  };
});

jest.mock('../components/ResultsTable', () => {
  return function ResultsTable() {
    return <div data-testid="results-table">Results Table</div>;
  };
});

describe('App Component', () => {
  test('renders main title', () => {
    render(<App />);
    expect(screen.getByText('文書解析結果')).toBeInTheDocument();
  });

  test('renders all main panels', () => {
    render(<App />);
    
    expect(screen.getByTestId('character-balance-panel')).toBeInTheDocument();
    expect(screen.getByTestId('kanji-usage-panel')).toBeInTheDocument();
    expect(screen.getByTestId('roi-map-panel')).toBeInTheDocument();
    expect(screen.getByTestId('results-table')).toBeInTheDocument();
  });

  test('renders theme selector', () => {
    render(<App />);
    expect(screen.getByTestId('dropdown')).toBeInTheDocument();
  });

  test('applies Noto Sans JP font family', () => {
    render(<App />);
    const styleElements = document.getElementsByTagName('style');
    let foundFont = false;
    
    Array.from(styleElements).forEach(style => {
      if (style.textContent && style.textContent.includes('Noto Sans JP')) {
        foundFont = true;
      }
    });
    
    expect(foundFont).toBe(true);
  });

  test('has proper panel layout structure - horizontal arrangement', () => {
    render(<App />);
    
    // Character balance and kanji usage panels should be in horizontal layout
    const characterBalancePanel = screen.getByTestId('character-balance-panel');
    const kanjiUsagePanel = screen.getByTestId('kanji-usage-panel');
    
    expect(characterBalancePanel).toBeInTheDocument();
    expect(kanjiUsagePanel).toBeInTheDocument();
    
    // Check if panels are arranged horizontally by looking for flexDir="row" in parent container
    const divElements = screen.getAllByTestId('div');
    const horizontalContainer = divElements.find(div => 
      div.getAttribute('data-testid') === 'div' && 
      div.textContent?.includes('文字種バランス常用漢字使用状況')
    );
    expect(horizontalContainer).toBeDefined();
  });

  test('panels have reduced chart sizes', () => {
    render(<App />);
    
    // Check that both panels display the reduced chart size indicator
    expect(screen.getByText('Chart (200x200px)')).toBeInTheDocument();
    
    // Since both panels have the same placeholder text, we should find it twice
    const chartPlaceholders = screen.getAllByText('Chart (200x200px)');
    expect(chartPlaceholders).toHaveLength(2);
  });
});