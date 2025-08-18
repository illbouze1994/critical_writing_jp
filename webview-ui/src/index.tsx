import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

const container = document.getElementById('app');
if (container) {
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    container
  );
}
