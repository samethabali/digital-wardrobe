import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { NotificationProvider } from './contexts/NotificationContext';
import { WardrobeProvider } from './contexts/WardrobeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotificationProvider>
      <WardrobeProvider>
        <App />
      </WardrobeProvider>
    </NotificationProvider>
  </StrictMode>,
);
