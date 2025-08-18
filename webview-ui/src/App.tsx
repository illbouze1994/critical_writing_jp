import React, { useState, useEffect } from 'react';
import { Div, Text, Dropdown, Anchor, ThemeProvider, StyleReset } from "atomize";
import { Provider as StyletronProvider } from 'styletron-react';
import type { DefaultTheme } from 'atomize/dist/types';
import CharacterBalancePanel from './components/CharacterBalancePanel';
import KanjiUsagePanel from './components/KanjiUsagePanel';
import RoiMapPanel from './components/RoiMapPanel';
import ResultsTable from './components/ResultsTable';
import { Client as Styletron } from 'styletron-engine-atomic';
import { themes, ThemeName } from './themes';

// 1. Create a client engine instance
const engine = new Styletron();

// Create a component that will apply global styles
const GlobalStyle = () => {
  return (
    <style>
      {`
        body {
          font-family: 'Noto Sans JP', sans-serif;
          background-color: ${themes.light.colors.background};
          color: ${themes.light.colors.textPrimary};
          margin: 0;
          padding: 0;
        }
      `}
    </style>
  );
};


const App = () => {
  const [theme, setTheme] = useState<DefaultTheme>(themes.light);
  const [themeName, setThemeName] = useState<ThemeName>('light');
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    // This is where we will listen for messages from the extension
    const handleMessage = (event: MessageEvent) => {
      const message = event.data; // The json object sent from the extension
      console.log('Message from extension:', message);
      // Example:
      // if (message.command === 'setTheme') {
      //   const newThemeName = message.theme as ThemeName;
      //   setThemeName(newThemeName);
      //   setTheme(themes[newThemeName]);
      // }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleThemeChange = (name: ThemeName) => {
    setThemeName(name);
    setTheme(themes[name]);
    setShowDropdown(false);
  };

  const themeMenu = (
    <Div shadow="4" rounded="md" bg="surface">
      {(Object.keys(themes) as ThemeName[]).map(name => (
        <Anchor
          key={name}
          d="block"
          p={{ y: "0.5rem", x: "1rem" }}
          onClick={() => handleThemeChange(name)}
          textColor={themeName === name ? "primary" : "textPrimary"}
        >
          {name.charAt(0).toUpperCase() + name.slice(1)}
        </Anchor>
      ))}
    </Div>
  );

  return (
    <StyletronProvider value={engine}>
      <ThemeProvider theme={theme}>
        <StyleReset />
        <GlobalStyle />
        <Div p="1rem">
          <Div d="flex" justify="space-between" align="center" m={{ b: "1rem" }}>
            <Text tag="h1" textSize="title" textColor="primary" m={{ b: "0" }}>
              文書解析結果
            </Text>
            <Dropdown
              isOpen={showDropdown}
              onClick={() => setShowDropdown(!showDropdown)}
              menu={themeMenu}
              w="fit-content"
            >
              Theme: {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
            </Dropdown>
          </Div>

          {/* Main content area */}
          <Div>
            {/* Character Balance and Kanji Usage panels arranged horizontally */}
            <Div d="flex" flexDir="row" m={{ t: "1rem" }} justify="space-between" h="250px" style={{ overflow: "hidden" }}>
              <Div w="48%" h="100%" m={{ r: "1rem" }} style={{ flexShrink: 0 }}>
                <CharacterBalancePanel />
              </Div>
              <Div w="48%" h="100%" style={{ flexShrink: 0 }}>
                <KanjiUsagePanel />
              </Div>
            </Div>

            {/* ROI Map panel below the statistics panels */}
            <Div m={{ t: "1rem", b: "1rem" }}>
              <RoiMapPanel />
            </Div>

            <Div m={{ t: "2rem" }}>
              <ResultsTable />
            </Div>
          </Div>
        </Div>
      </ThemeProvider>
    </StyletronProvider>
  );
};

export default App;
