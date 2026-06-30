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
  isCapital?: boolean;
}

interface GameContextType {
  cities: City[];
  selectedCity: City | null;
  socket: Socket | null;
  onlineUsers: Set<string>;
  loading: boolean;
  fetchCities: () => Promise<void>;
  selectCity: (city: City) => void;
  updateCityResources: (cityId: string, resources: Record<string, number>) => void;
  createCity: (name: string, x: number, y: number) => Promise<{ success: boolean; city?: City; error?: string }>;
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
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const isRelative = apiUrl.startsWith('/');
      // For relative URLs (/api or /republica/api), connect socket to current origin;
      // for absolute, strip /api
      const wsUrl = isRelative ? window.location.origin : apiUrl.replace('/api', '');
      // When served under a base path (e.g. /republica/api), the socket.io endpoint
      // lives under the same prefix (/republica/socket.io). Empty prefix -> default.
      const basePath = isRelative ? apiUrl.replace(/\/api$/, '') : '';
      const newSocket = io(wsUrl, {
        path: `${basePath}/socket.io`,
        transports: ['websocket', 'polling'],
      });

      newSocket.on('connect', () => {
        console.log('Connected to server');
        // join-world first so the server can attribute presence to the right world,
        // then join-user to receive personal notifications and broadcast presence
        newSocket.emit('join-world', user.worldId);
        newSocket.emit('join-user', user.id);
      });

      newSocket.on('presence-snapshot', (data: { online: string[] }) => {
        setOnlineUsers(new Set(data.online));
      });

      newSocket.on('presence-update', (data: { userId: string; online: boolean }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          if (data.online) next.add(data.userId);
          else next.delete(data.userId);
          return next;
        });
      });

      newSocket.on('city-updated', (data) => {
        updateCityData(data.cityId, data);
      });

      newSocket.on('resources-updated', (data) => {
        updateCityData(data.cityId, { resources: data.resources });
      });

      newSocket.on('production-update', (data) => {
        console.log('Production update received:', data);
        updateCityData(data.cityId, {
          resources: data.resources,
          production: data.production,
          population: data.population,
          happiness: data.happiness
        });
      });

      setSocket(newSocket);

      return () => {
        newSocket.disconnect();
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Keep the socket joined to the SELECTED city's room — on first selection, on
  // city switch, and after every (re)connect. The scheduler emits
  // 'production-update' only to `city-<id>` (scheduler.js), so without a reliable
  // join the resource bar freezes until a manual refresh (F5). socket.io drops
  // room membership on reconnect (new socket id), hence the re-join on 'connect'.
  useEffect(() => {
    if (!socket || !selectedCity) return;
    const joinCityRoom = () => socket.emit('join-city', selectedCity.id);
    joinCityRoom();
    socket.on('connect', joinCityRoom);
    return () => { socket.off('connect', joinCityRoom); };
  }, [socket, selectedCity]);

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

  // Load the player's cities once on login so the "City" nav link and the
  // resource top-bar are available on EVERY page, not only on Dashboard/Military
  // (previously the city menu vanished on World Map, Politics, etc.).
  useEffect(() => {
    if (user) fetchCities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  const createCity = async (name: string, x: number, y: number) => {
    try {
      const response = await api.post('/cities/create', { name, x, y });
      const newCity = response.data.city;
      setCities(prevCities => [...prevCities, newCity]);
      if (cities.length === 0) {
        setSelectedCity(newCity);
      }
      return { success: true, city: newCity };
    } catch (error: any) {
      console.error('Failed to create city:', error);
      const errorMessage = error.response?.data?.error || 'Failed to create city';
      return { success: false, error: errorMessage };
    }
  };

  return (
    <GameContext.Provider
      value={{
        cities,
        selectedCity,
        socket,
        onlineUsers,
        loading,
        fetchCities,
        selectCity,
        updateCityResources,
        createCity,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};