import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Register from './components/Register';
import AppShell from './components/layout/AppShell';
import { StylistProvider } from './contexts/StylistContext';

import WardrobeView from './views/WardrobeView';
import OutfitsView from './views/OutfitsView';
import CreateView from './views/CreateView';
import ExploreView from './views/ExploreView';
import ProfileView from './views/ProfileView';

export default function App() {
  return (
    <Router>
      <StylistProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route index element={<WardrobeView />} />
            <Route path="kombinler" element={<OutfitsView />} />
            <Route path="olustur" element={<CreateView />} />
            <Route path="kesfet" element={<ExploreView />} />
            <Route path="profil" element={<ProfileView />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </StylistProvider>
    </Router>
  );
}
