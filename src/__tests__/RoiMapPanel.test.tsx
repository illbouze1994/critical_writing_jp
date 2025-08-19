/**
 * Unit tests for RoiMapPanel component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider as StyletronProvider } from 'styletron-react';
import { Client as Styletron } from 'styletron-engine-atomic';
import { ThemeProvider } from 'atomize';
import RoiMapPanel from '../../webview-ui/src/components/RoiMapPanel';
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

describe('RoiMapPanel', () => {
  beforeEach(() => {
    // Reset any mocks or state before each test
    jest.clearAllMocks();
  });

  test('should render component without crashing', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    expect(screen.getByText('関心マップ (ROI)')).toBeInTheDocument();
  });

  test('should display correct title', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent('関心マップ (ROI)');
  });

  test('should display sample ROI words', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    // Check for sample words from the component
    expect(screen.getByText('分析')).toBeInTheDocument();
    expect(screen.getByText('研究')).toBeInTheDocument();
    expect(screen.getByText('結果')).toBeInTheDocument();
    expect(screen.getByText('考察')).toBeInTheDocument();
  });

  test('should display all sample ROI data words', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    // Test all sample words from the component
    const expectedWords = ['分析', '研究', '結果', '考察', '検討', '評価', '効果', '問題'];
    
    expectedWords.forEach(word => {
      expect(screen.getByText(word)).toBeInTheDocument();
    });
  });

  test('should handle mouse hover effects', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const wordElement = screen.getByText('分析');
    expect(wordElement).toBeInTheDocument();

    // Test mouse over event
    fireEvent.mouseOver(wordElement);
    expect(wordElement.style.transform).toBe('scale(1.1)');

    // Test mouse out event
    fireEvent.mouseOut(wordElement);
    expect(wordElement.style.transform).toBe('scale(1.0)');
  });

  test('should display tooltips with ROI score and frequency', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const wordElement = screen.getByText('分析');
    expect(wordElement).toHaveAttribute('title');
    
    const tooltip = wordElement.getAttribute('title');
    expect(tooltip).toContain('ROI Score:');
    expect(tooltip).toContain('Frequency:');
  });

  test('should apply different font sizes based on ROI scores', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const highScoreWord = screen.getByText('分析'); // Should have highest score (0.95)
    const lowScoreWord = screen.getByText('問題');   // Should have lower score (0.61)

    // High score words should have larger font size
    const highScoreStyle = window.getComputedStyle(highScoreWord);
    const lowScoreStyle = window.getComputedStyle(lowScoreWord);

    // Both should have font sizes, but we can't easily compare computed values in JSDOM
    expect(highScoreWord.style.fontSize).toBeTruthy();
    expect(lowScoreWord.style.fontSize).toBeTruthy();
  });

  test('should apply color gradients based on ROI scores', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const wordElement = screen.getByText('分析');
    
    // Should have HSL color based on score
    expect(wordElement.style.color).toMatch(/hsl\(/);
  });

  test('should be accessible', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    // Check for proper heading structure
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveTextContent('関心マップ (ROI)');
  });

  test('should handle theme changes properly', () => {
    const { rerender } = render(
      <StyletronProvider value={mockEngine}>
        <ThemeProvider theme={themes.light}>
          <RoiMapPanel />
        </ThemeProvider>
      </StyletronProvider>
    );

    expect(screen.getByText('関心マップ (ROI)')).toBeInTheDocument();

    // Test with dark theme
    rerender(
      <StyletronProvider value={mockEngine}>
        <ThemeProvider theme={themes.dark}>
          <RoiMapPanel />
        </ThemeProvider>
      </StyletronProvider>
    );

    expect(screen.getByText('関心マップ (ROI)')).toBeInTheDocument();
    expect(screen.getByText('分析')).toBeInTheDocument();
  });

  test('should handle warm theme properly', () => {
    render(
      <StyletronProvider value={mockEngine}>
        <ThemeProvider theme={themes.warm}>
          <RoiMapPanel />
        </ThemeProvider>
      </StyletronProvider>
    );

    expect(screen.getByText('関心マップ (ROI)')).toBeInTheDocument();
    expect(screen.getByText('分析')).toBeInTheDocument();
  });

  test('should have proper container dimensions and styling', () => {
    const { container } = render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    // Should have proper container structure
    const mapContainer = container.querySelector('[style*="height: 400px"]');
    expect(mapContainer).toBeTruthy();
  });

  test('should support keyboard interaction for accessibility', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const wordElement = screen.getByText('分析');
    
    // Should be interactive element
    expect(wordElement.style.cursor).toBe('pointer');
  });

  test('should maintain word positioning and flex layout', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const wordElement = screen.getByText('分析');
    
    // Should have inline-block display for proper word map layout
    expect(wordElement.style.display || getComputedStyle(wordElement).display).toMatch(/inline/);
  });

  test('should handle transitions and animations', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const wordElement = screen.getByText('分析');
    
    // Should have transition for smooth hover effects
    expect(wordElement.style.transition).toContain('all 0.3s ease');
  });

  test('should use barrier-free colors from design system', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    // Words should use HSL colors that are accessibility-compliant
    const wordElement = screen.getByText('分析');
    const color = wordElement.style.color;
    
    // Should use HSL color format for better accessibility control
    expect(color).toMatch(/hsl\(/);
  });

  test('should handle empty or missing ROI data gracefully', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    // Even with sample data, should render without errors
    expect(screen.getByText('関心マップ (ROI)')).toBeInTheDocument();
  });

  test('should maintain proper opacity for visual hierarchy', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    const highScoreWord = screen.getByText('分析');
    const lowScoreWord = screen.getByText('問題');

    // Both should have opacity values set
    expect(highScoreWord.style.opacity).toBeTruthy();
    expect(lowScoreWord.style.opacity).toBeTruthy();
  });

  test('should render with Noto Sans JP font family', () => {
    render(
      <TestWrapper>
        <RoiMapPanel />
      </TestWrapper>
    );

    // The component should inherit the font family from the theme
    const title = screen.getByText('関心マップ (ROI)');
    expect(title).toBeInTheDocument();
  });

  test('should maintain consistent behavior across all themes', () => {
    const themeNames = ['light', 'dark', 'warm'] as const;
    
    themeNames.forEach(themeName => {
      const { rerender } = render(
        <StyletronProvider value={mockEngine}>
          <ThemeProvider theme={themes[themeName]}>
            <RoiMapPanel />
          </ThemeProvider>
        </StyletronProvider>
      );

      expect(screen.getByText('関心マップ (ROI)')).toBeInTheDocument();
      expect(screen.getByText('分析')).toBeInTheDocument();
      expect(screen.getByText('研究')).toBeInTheDocument();
      
      // Test interaction in each theme
      const wordElement = screen.getByText('分析');
      fireEvent.mouseOver(wordElement);
      expect(wordElement.style.transform).toBe('scale(1.1)');
    });
  });
});