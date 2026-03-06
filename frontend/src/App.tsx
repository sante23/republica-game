import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/ToastContainer';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import City from './pages/City';
import Market from './pages/Market';
import Politics from './pages/Politics';
import Leaderboard from './pages/Leaderboard';
import WorldMap from './pages/WorldMap';
import Military from './pages/Military';
import Economy from './pages/Economy';
import Government from './pages/Government';
import ProtectedRoute from './components/ProtectedRoute';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <GameProvider>
            <ToastContainer />
            <div className="App">
              <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/city/:id" element={
                <ProtectedRoute>
                  <City />
                </ProtectedRoute>
              } />
              <Route path="/market" element={
                <ProtectedRoute>
                  <Market />
                </ProtectedRoute>
              } />
              <Route path="/politics" element={
                <ProtectedRoute>
                  <Politics />
                </ProtectedRoute>
              } />
              <Route path="/leaderboard" element={
                <ProtectedRoute>
                  <Leaderboard />
                </ProtectedRoute>
              } />
              <Route path="/world-map" element={
                <ProtectedRoute>
                  <WorldMap />
                </ProtectedRoute>
              } />
              <Route path="/military" element={
                <ProtectedRoute>
                  <Military />
                </ProtectedRoute>
              } />
              <Route path="/economy" element={
                <ProtectedRoute>
                  <Economy />
                </ProtectedRoute>
              } />
              <Route path="/government" element={
                <ProtectedRoute>
                  <Government />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
            </div>
          </GameProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
