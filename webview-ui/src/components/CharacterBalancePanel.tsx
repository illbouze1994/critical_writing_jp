import React from 'react';
import { Div, Text } from "atomize";

const CharacterBalancePanel = () => {
  return (
    <Div h="100%" style={{ overflow: "hidden" }} d="flex" flexDir="column">
      <Text tag="h2" textSize="title" m={{ b: "0.5rem" }}>
        文字種バランス
      </Text>
      {/* Chart will go here */}
      <Div bg="gray200" h="120px" w="120px" m={{ t: "0.5rem" }} d="flex" align="center" justify="center" style={{ flexShrink: 0 }}>
        <Text>Chart (120x120px)</Text>
      </Div>
    </Div>
  );
};

export default CharacterBalancePanel;