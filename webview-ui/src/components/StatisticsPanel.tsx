import React from 'react';
import { Div, Text } from "atomize";

const StatisticsPanel = () => {
  return (
    <Div>
      <Text tag="h2" textSize="title">
        文字種バランス
      </Text>
      {/* Chart will go here */}
      <Div bg="gray200" h="300px" w="300px" m={{ t: "1rem" }} d="flex" align="center" justify="center">
        <Text>Chart (300x300px)</Text>
      </Div>

      <Text tag="h2" textSize="title" m={{ t: "2rem" }}>
        常用漢字使用状況
      </Text>
      {/* Chart will go here */}
      <Div bg="gray200" h="300px" w="300px" m={{ t: "1rem" }} d="flex" align="center" justify="center">
        <Text>Chart (300x300px)</Text>
      </Div>
    </Div>
  );
};

export default StatisticsPanel;
