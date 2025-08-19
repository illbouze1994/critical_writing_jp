import React from 'react';
import { render } from '@testing-library/react';
import ParagraphCard, { ParagraphData } from '../components/ParagraphCard';

// Mock the chart components as they are complex and tested separately
jest.mock('../components/CharacterBalanceChart', () => () => <div>CharacterBalanceChart</div>);
jest.mock('../components/KanjiUsageChart', () => () => <div>KanjiUsageChart</div>);

describe('ParagraphCard', () => {
  it('renders correctly with given paragraph data', () => {
    const paragraph: ParagraphData = {
      id: 'p1',
      content: 'This is a test paragraph that is long enough to be truncated.',
      charCount: 150,
      charBalance: [], // Mocked, so data doesn't matter
      kanjiUsage: [],  // Mocked, so data doesn't matter
    };

    const { asFragment } = render(<ParagraphCard paragraph={paragraph} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
