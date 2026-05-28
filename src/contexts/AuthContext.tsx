import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (email: string, password: string, name: string, username: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: { email?: string; username?: string; name?: string; password?: string; isPrivate?: boolean }) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('aura_token'));
  const [loading, setLoading] = useState(true);

  // Initialize and check current token
  useEffect(() => {
    async function checkAuth() {
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          // Token expired or invalid
          logout();
        }
      } catch (err) {
        console.error('Auth verification failed:', err);
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [token]);

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Giriş yapılamadı.' };
      }

      localStorage.setItem('aura_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' };
    }
  };

  const register = async (email: string, password: string, name: string, username: string) => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, username })
      });

      const data = await response.json();
      if (!response.ok) {
        return { success: false, error: data.error || 'Kayıt işlemi başarısız.' };
      }

      localStorage.setItem('aura_token', data.token);
      setToken(data.token);
      setUser(data.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' };
    }
  };

  const updateProfile = async (data: { email?: string; username?: string; name?: string; password?: string; isPrivate?: boolean }) => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(data)
      });

      const resData = await response.json();
      if (!response.ok) {
        return { success: false, error: resData.error || 'Profil güncellenemedi.' };
      }

      localStorage.setItem('aura_token', resData.token);
      setToken(resData.token);
      setUser(resData.user);
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' };
    }
  };

  const deleteAccount = async () => {
    try {
      const response = await fetch('/api/auth/profile', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const resData = await response.json();
      if (!response.ok) {
        return { success: false, error: resData.error || 'Hesap silinemedi.' };
      }

      // Oturumu kapat
      localStorage.removeItem('aura_token');
      setToken(null);
      setUser(null);
      window.location.href = '/login';
      return { success: true };
    } catch (err) {
      return { success: false, error: 'Sunucuyla bağlantı kurulamadı.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('aura_token');
    setToken(null);
    setUser(null);
    // Force refresh context to clear all data
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, updateProfile, deleteAccount, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
