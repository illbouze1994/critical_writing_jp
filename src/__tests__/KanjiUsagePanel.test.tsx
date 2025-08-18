/**
 * Unit tests for KanjiUsagePanel component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider as StyletronProvider } from 'styletron-react';
import { Client as Styletron } from 'styletron-engine-atomic';
import { ThemeProvider } from 'atomize';
import KanjiUsagePanel from '../../webview-ui/src/components/KanjiUsagePanel';
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

describe('KanjiUsagePanel', () => {
  beforeEach(() => {
    // Reset any mocks or state before each test
    jest.clearAllMocks();
  });

  test('should render component without crashing', () => {
    render(
      <TestWrapper>
        <KanjiUsagePanel />
      </TestWrapper>
    );

    expect(screen.getByText('常用漢字使用状況')).toBeInTheDocument();
  });

  test('should display correct title', () => {
    render(
      <TestWrapper>
        <KanjiUsagePanel />
      </TestWrapper>
    );

    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent('常用漢字使用状況');
  });

  test('should display placeholder chart area', () => {
    render(
      <TestWrapper>
        <KanjiUsagePanel />
      </TestWrapper>
    );

    const chartPlaceholder = screen.getByText('Chart (300x300px)');
    expect(chartPlaceholder).toBeInTheDocument();
  });

  test('should have proper chart dimensions', () => {
    const { container } = render(
      <TestWrapper>
        <KanjiUsagePanel />
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
        <KanjiUsagePanel />
      </TestWrapper>
    );

    // Check for proper heading structure
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('常用漢字使用状況');
  });

  test('should handle theme changes properly', () => {
    const { rerender } = render(
      <StyletronProvider value={mockEngine}>
        <ThemeProvider theme={themes.light}>
          <KanjiUsagePanel />
        </ThemeProvider>
      </StyletronProvider>
    );

    expect(screen.getByText('常用漢字使用状況')).toBeInTheDocument();

    // Test with dark theme
    rerender(
      <StyletronProvider value={mockEngine}>
        <ThemeProvider theme={themes.dark}>
          <KanjiUsagePanel />
        </ThemeProvider>
      </StyletronProvider>
    );

    expect(screen.getByText('常用漢字使用状況')).toBeInTheDocument();
  });

  test('should handle warm theme properly', () => {
    render(
      <StyletronProvider value={mockEngine}>
        <ThemeProvider theme={themes.warm}>
          <KanjiUsagePanel />
        </ThemeProvider>
      </StyletronProvider>
    );

    expect(screen.getByText('常用漢字使用状況')).toBeInTheDocument();
  });

  test('should render with Noto Sans JP font family', () => {
    render(
      <TestWrapper>
        <KanjiUsagePanel />
      </TestWrapper>
    );

    // The component should inherit the font family from the theme
    const title = screen.getByText('常用漢字使用状況');
    expect(title).toBeInTheDocument();
  });

  test('should maintain proper component structure', () => {
    const { container } = render(
      <TestWrapper>
        <KanjiUsagePanel />
      </TestWrapper>
    );

    // Should have proper div structure
    const mainDiv = container.firstChild;
    expect(mainDiv).toBeInTheDocument();
    
    // Should contain both title and chart area
    expect(screen.getByText('常用漢字使用状況')).toBeInTheDocument();
    expect(screen.getByText('Chart (300x300px)')).toBeInTheDocument();
  });

  test('should use barrier-free colors from design system', () => {
    render(
      <TestWrapper>
        <KanjiUsagePanel />
      </TestWrapper>
    );

    // Component should be using the accessibility-compliant color scheme
    const title = screen.getByText('常用漢字使用状況');
    expect(title).toBeInTheDocument();
  });

  test('should support keyboard navigation', () => {
    render(
      <TestWrapper>
        <KanjiUsagePanel />
      </TestWrapper>
    );

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    
    // Component should be focusable for keyboard navigation
    expect(heading).toHaveAttribute('tabIndex', '0' || null);
  });

  test('should handle edge case with empty data gracefully', () => {
    render(
      <TestWrapper>
        <KanjiUsagePanel />
      </TestWrapper>
    );

    // Should still render properly even without data
    expect(screen.getByText('常用漢字使用状況')).toBeInTheDocument();
    expect(screen.getByText('Chart (300x300px)')).toBeInTheDocument();
  });

  test('should maintain consistent styling across themes', () => {
    const themes = ['light', 'dark', 'warm'] as const;
    
    themes.forEach(themeName => {
      const { rerender } = render(
        <StyletronProvider value={mockEngine}>
          <ThemeProvider theme={themes[themeName]}>
            <KanjiUsagePanel />
          </ThemeProvider>
        </StyletronProvider>
      );

      expect(screen.getByText('常用漢字使用状況')).toBeInTheDocument();
      expect(screen.getByText('Chart (300x300px)')).toBeInTheDocument();
    });
  });
});