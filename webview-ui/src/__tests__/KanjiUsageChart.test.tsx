import React from 'react';
import { render } from '@testing-library/react';
import KanjiUsageChart, { KanjiUsageData } from '../components/KanjiUsageChart';

// ResponsiveContainer makes tests difficult, so we mock it.
jest.mock('recharts', () => {
  const OriginalModule = jest.requireActual('recharts');
  return {
    ...OriginalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div style={{ width: 400, height: 250 }}>{children}</div>
    ),
  };
});

describe('KanjiUsageChart', () => {
  it('renders correctly with given data', () => {
    const data: KanjiUsageData[] = [
      { name: '常用漢字', value: 90 },
      { name: '非常用漢字', value: 10 },
    ];

    const { asFragment } = render(<KanjiUsageChart data={data} />);
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders a smaller version correctly', () => {
     const data: KanjiUsageData[] = [
      { name: '常用漢字', value: 90 },
      { name: '非常用漢字', value: 10 },
    ];

    const { asFragment } = render(<KanjiUsageChart data={data} height={80} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
