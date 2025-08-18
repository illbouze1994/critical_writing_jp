import React from 'react';
import { Div, Text } from "atomize";

const KanjiUsagePanel = () => {
  return (
    <Div h="100%" style={{ overflow: "hidden" }} d="flex" flexDir="column">
      <Text tag="h2" textSize="title" m={{ b: "0.5rem" }}>
        常用漢字使用状況
      </Text>
      {/* Chart will go here */}
      <Div bg="gray200" h="150px" w="150px" m={{ t: "0.5rem" }} d="flex" align="center" justify="center" style={{ flexShrink: 0 }}>
        <Text>Chart (150x150px)</Text>
      </Div>
    </Div>
  );
};

export default KanjiUsagePanel;