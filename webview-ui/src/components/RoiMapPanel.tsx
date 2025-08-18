import React from 'react';
import { Div, Text } from "atomize";

const RoiMapPanel = () => {
  return (
    <Div>
      <Text tag="h2" textSize="title">
        関心マップ (ROI)
      </Text>
      <Div bg="gray200" h="640px" m={{ t: "1rem" }} d="flex" align="center" justify="center">
        <Text>ROI Word Map will go here</Text>
      </Div>
    </Div>
  );
};

export default RoiMapPanel;
