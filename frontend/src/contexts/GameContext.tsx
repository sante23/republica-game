import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../config/api';
import { useAuth } from './AuthContext';

interface City {
  id: string;
  name: string;
  x: number;
  y: number;
  population: number;
  happiness: number;
  resources: Record<string, number>;
  buildings: Record<string, number>;
  production: Record<string, number>;
  consumption: Record<string, number>;
}

interface GameContextType {
  cities: City[];
  selectedCity: City | null;
  socket: Socket | null;
  loading: boolean;
  fetchCities: () => Promise<void>;
  selectCity: (city: City) => void;
  updateCityResources: (cityId: string, resources: Record<string, number>) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const useGame = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
};

export const GameProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cities, setCities] = useState<City[]>([]);
  const [selectedCity, setSelectedCity] = useState<City | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const newSocket = io('http://localhost:5000', {
        transports: ['websocket'],
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        newSocket.emit('join-world', user.worldId);
      });

      newSocket.on('city-updated', (data) => {
        updateCityData(data.cityId, data);
      });

      newSocket.on('resources-updated', (data) => {
        updateCityData(data.cityId, { resources: data.resources });
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user]);

  const fetchCities = async () => {
    setLoading(true);
    try {
      const response = await api.get('/cities/my');
      setCities(response.data.cities);
      if (response.data.cities.length > 0 && !selectedCity) {
        setSelectedCity(response.data.cities[0]);
      }
    } catch (error) {
      console.error('Failed to fetch cities:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectCity = (city: City) => {
    setSelectedCity(city);
    if (socket) {
      socket.emit('join-city', city.id);
    }
  };

  const updateCityData = (cityId: string, updates: Partial<City>) => {
    setCities(prevCities =>
      prevCities.map(city =>
        city.id === cityId ? { ...city, ...updates } : city
      )
    );
    if (selectedCity?.id === cityId) {
      setSelectedCity(prev => prev ? { ...prev, ...updates } : null);
    }
  };

  const updateCityResources = (cityId: string, resources: Record<string, number>) => {
    updateCityData(cityId, { resources });
  };

  return (
    <GameContext.Provider
      value={{
        cities,
        selectedCity,
        socket,
        loading,
        fetchCities,
        selectCity,
        updateCityResources,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};