import React from 'react';
import { render } from '@testing-library/react';
import CharacterBalanceChart, { CharBalanceData } from '../components/CharacterBalanceChart';

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

describe('CharacterBalanceChart', () => {
  it('renders correctly with given data', () => {
    const data: CharBalanceData[] = [
      { name: 'ひらがな', value: 100 },
      { name: 'カタカナ', value: 50 },
      { name: '漢字', value: 80 },
      { name: '英数字', value: 20 },
      { name: 'その他', value: 10 },
    ];

    const { asFragment } = render(<CharacterBalanceChart data={data} />);
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders a smaller version correctly', () => {
    const data: CharBalanceData[] = [
      { name: 'ひらがな', value: 100 },
      { name: 'カタカナ', value: 50 },
      { name: '漢字', value: 80 },
      { name: '英数字', value: 20 },
      { name: 'その他', value: 10 },
    ];

    const { asFragment } = render(<CharacterBalanceChart data={data} height={80} />);
    expect(asFragment()).toMatchSnapshot();
  });
});
