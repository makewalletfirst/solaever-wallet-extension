import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// 일부 라이브러리가 전역 Buffer/process를 직접 참조할 수 있어 수동 할당
import { Buffer } from 'buffer';
window.Buffer = Buffer;
window.process = { env: {} } as any;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
