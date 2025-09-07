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
      head: 'This is a test paragraph.',
      chars: 150,
      features: {
        hiragana_ratio: 0.4,
        katakana_ratio: 0.1,
        kanji_ratio: 0.3,
        alphanumeric_ratio: 0.2,
        joyo_kanji_usage: 0.9,
      },
    };

    const { asFragment } = render(<ParagraphCard paragraph={paragraph} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
