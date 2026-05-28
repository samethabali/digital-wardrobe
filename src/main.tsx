import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { NotificationProvider } from './contexts/NotificationContext';
import { AuthProvider } from './contexts/AuthContext';
import { WardrobeProvider } from './contexts/WardrobeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NotificationProvider>
      <AuthProvider>
        <WardrobeProvider>
          <App />
        </WardrobeProvider>
      </AuthProvider>
    </NotificationProvider>
  </StrictMode>,
);
