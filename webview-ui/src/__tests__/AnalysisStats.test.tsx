import React from 'react';
import { render } from '@testing-library/react';
import AnalysisStats from '../components/AnalysisStats';

import React from 'react';
import { render } from '@testing-library/react';
import AnalysisStats from '../components/AnalysisStats';

describe('AnalysisStats', () => {
  it('renders correctly with given props', () => {
    const { asFragment } = render(
      <AnalysisStats
        paragraphCount={10}
        charCount={2500}
        overLimitCount={2}
        underLimitCount={3}
      />
    );
    expect(asFragment()).toMatchSnapshot();
  });

  it('renders correctly with default props', () => {
    const { asFragment } = render(<AnalysisStats />);
    expect(asFragment()).toMatchSnapshot();
  });
});
