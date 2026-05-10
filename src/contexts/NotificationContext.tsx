import React, { createContext, useContext, useState, ReactNode } from 'react';
import NotificationCenter, { Notification } from '../components/NotificationCenter';
import PromptModal from '../components/PromptModal';

interface NotificationContextType {
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  ask: (title: string, defaultValue?: string) => Promise<string | null>;
  askConfirm: (title: string, message: string) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    title: string;
    defaultValue: string;
    resolve: (val: string | null) => void;
  }>({ isOpen: false, title: '', defaultValue: '', resolve: () => {} });

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    resolve: (val: boolean) => void;
  }>({ isOpen: false, title: '', message: '', resolve: () => {} });

  const notify = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Math.random().toString(36).slice(2, 9);
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), 5000);
  };

  const ask = (title: string, defaultValue: string = ''): Promise<string | null> => {
    return new Promise((resolve) => {
      setPromptConfig({ isOpen: true, title, defaultValue, resolve });
    });
  };

  const askConfirm = (title: string, message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmConfig({ isOpen: true, title, message, resolve });
    });
  };

  return (
    <NotificationContext.Provider value={{ notify, ask, askConfirm }}>
      {children}
      <NotificationCenter 
        notifications={notifications} 
        onClose={(id) => setNotifications(prev => prev.filter(n => n.id !== id))} 
      />
      
      <PromptModal
        isOpen={promptConfig.isOpen}
        title={promptConfig.title}
        defaultValue={promptConfig.defaultValue}
        onConfirm={(val) => {
          promptConfig.resolve(val);
          setPromptConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => {
          promptConfig.resolve(null);
          setPromptConfig(prev => ({ ...prev, isOpen: false }));
        }}
      />

      <PromptModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmOnly
        onConfirm={() => {
          confirmConfig.resolve(true);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => {
          confirmConfig.resolve(false);
          setConfirmConfig(prev => ({ ...prev, isOpen: false }));
        }}
      />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}
