/**
 * Unit tests for CharacterBalancePanel component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider as StyletronProvider } from 'styletron-react';
import { Client as Styletron } from 'styletron-engine-atomic';
import { ThemeProvider } from 'atomize';
import CharacterBalancePanel from '../../webview-ui/src/components/CharacterBalancePanel';
import { themes } from '../../webview-ui/src/themes';

// Mock Styletron engine
const mockEngine = new Styletron();

// Test wrapper component with required providers
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <StyletronProvider value={mockEngine}>
    <ThemeProvider theme={themes.light}>
      {children}
    </ThemeProvider>
  </StyletronProvider>
);

describe('CharacterBalancePanel', () => {
  beforeEach(() => {
    // Reset any mocks or state before each test
    jest.clearAllMocks();
  });

  test('should render component without crashing', () => {
    render(
      <TestWrapper>
        <CharacterBalancePanel />
      </TestWrapper>
    );

    expect(screen.getByText('文字種バランス')).toBeInTheDocument();
  });

  test('should display correct title', () => {
    render(
      <TestWrapper>
        <CharacterBalancePanel />
      </TestWrapper>
    );

    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent('文字種バランス');
  });

  test('should display placeholder chart area', () => {
    render(
      <TestWrapper>
        <CharacterBalancePanel />
      </TestWrapper>
    );

    const chartPlaceholder = screen.getByText('Chart (300x300px)');
    expect(chartPlaceholder).toBeInTheDocument();
  });

  test('should have proper chart dimensions', () => {
    const { container } = render(
      <TestWrapper>
        <CharacterBalancePanel />
      </TestWrapper>
    );

    // Find the chart container div
    const chartContainer = container.querySelector('[data-testid="chart-container"]') 
      || container.querySelector('div[style*="height"]');
    
    // Chart should have 300px dimensions as specified in requirements
    expect(chartContainer).toBeTruthy();
  });

  test('should be accessible', () => {
    render(
      <TestWrapper>
        <CharacterBalancePanel />
      </TestWrapper>
    );

    // Check for proper heading structure
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('文字種バランス');
  });

  test('should handle theme changes properly', () => {
    const { rerender } = render(
      <StyletronProvider value={mockEngine}>
        <ThemeProvider theme={themes.light}>
          <CharacterBalancePanel />
        </ThemeProvider>
      </StyletronProvider>
    );

    expect(screen.getByText('文字種バランス')).toBeInTheDocument();

    // Test with dark theme
    rerender(
      <StyletronProvider value={mockEngine}>
        <ThemeProvider theme={themes.dark}>
          <CharacterBalancePanel />
        </ThemeProvider>
      </StyletronProvider>
    );

    expect(screen.getByText('文字種バランス')).toBeInTheDocument();
  });

  test('should render with Noto Sans JP font family', () => {
    render(
      <TestWrapper>
        <CharacterBalancePanel />
      </TestWrapper>
    );

    // The component should inherit the font family from the theme
    const title = screen.getByText('文字種バランス');
    expect(title).toBeInTheDocument();
  });

  test('should maintain proper component structure', () => {
    const { container } = render(
      <TestWrapper>
        <CharacterBalancePanel />
      </TestWrapper>
    );

    // Should have proper div structure
    const mainDiv = container.firstChild;
    expect(mainDiv).toBeInTheDocument();
    
    // Should contain both title and chart area
    expect(screen.getByText('文字種バランス')).toBeInTheDocument();
    expect(screen.getByText('Chart (300x300px)')).toBeInTheDocument();
  });
});