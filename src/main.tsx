import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { MantineProvider, createTheme } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';

import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';

import App from './App';
import './index.css';
import { AuthProvider } from './AuthContext';

const theme = createTheme({
  colors: {
    navy: [
      "#e3e8f0",
      "#c5cfdf",
      "#a6b5ce",
      "#879cbe",
      "#6882ad",
      "#4a699c",
      "#2b4f8c",
      "#0e2b56",
      "#0c2448",
      "#091c39"
    ],
    olive: [
      "#f3f4df",
      "#e3e5b7",
      "#d2d68f",
      "#c2c867",
      "#b1b93f",
      "#a1a23b",
      "#828530",
      "#646825",
      "#454b1a",
      "#272e0f"
    ],
    redDark: [
      "#f6e4e2",
      "#ecc1bd",
      "#e09e97",
      "#d57b70",
      "#ca5849",
      "#a62d28",
      "#87251f",
      "#671c17",
      "#47130f",
      "#270a08"
    ],
    grayDark: [
      "#e8e8e8",
      "#d2d2d2",
      "#bbbbbb",
      "#a5a5a5",
      "#8f8f8f",
      "#787878",
      "#626262",
      "#3c3c3c",
      "#2e2e2e",
      "#1f1f1f"
    ]
  },

  primaryColor: 'navy',
  defaultRadius: 'md',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <MantineProvider theme={theme}>
      <ModalsProvider>
        <HashRouter>
          <AuthProvider>
            <App />
            <Notifications />
          </AuthProvider>
        </HashRouter>
      </ModalsProvider>
    </MantineProvider>
  </React.StrictMode>
);

