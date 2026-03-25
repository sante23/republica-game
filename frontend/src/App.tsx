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
import Achievements from './pages/Achievements';
import Banking from './pages/Banking';
import Contracts from './pages/Contracts';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import TutorialOverlay from './components/TutorialOverlay';
import ChatPanel from './components/ChatPanel';
import EventsBanner from './components/EventsBanner';
import './App.css';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <GameProvider>
            <ToastContainer />
            <TutorialOverlay />
            <ChatPanel />
            <div className="App">
              <Navbar />
              <EventsBanner />
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
              <Route path="/achievements" element={
                <ProtectedRoute>
                  <Achievements />
                </ProtectedRoute>
              } />
              <Route path="/banking" element={
                <ProtectedRoute>
                  <Banking />
                </ProtectedRoute>
              } />
              <Route path="/contracts" element={
                <ProtectedRoute>
                  <Contracts />
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
