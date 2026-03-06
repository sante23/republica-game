import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { ArrowLeft, MapPin, Users, Crown } from 'lucide-react';
import './WorldMap.css';

interface WorldCity {
  id: string;
  name: string;
  x: number;
  y: number;
  population: number;
  isCapital: boolean;
  userId: string;
  owner: {
    username: string;
    level: number;
  };
}

const WorldMap: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cities, setCities] = useState<WorldCity[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  useEffect(() => {
    fetchWorldCities();
  }, []);

  const fetchWorldCities = async () => {
    try {
      // Try to get all cities from the backend
      const response = await api.get('/cities/my'); // We'll use this for now
      setCities(response.data.cities);
    } catch (error) {
      console.error('Failed to fetch world cities:', error);
    } finally {
      setLoading(false);
    }
  };

  const goToCity = (cityId: string, ownerId: string) => {
    if (ownerId === user?.id) {
      navigate(`/city/${cityId}`);
    }
  };

  // Calculate map bounds
  const minX = Math.min(...cities.map(c => c.x), -100);
  const maxX = Math.max(...cities.map(c => c.x), 100);
  const minY = Math.min(...cities.map(c => c.y), -100);
  const maxY = Math.max(...cities.map(c => c.y), 100);

  const mapWidth = maxX - minX;
  const mapHeight = maxY - minY;

  return (
    <div className="world-map-page">
      <header className="world-map-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1>🗺️ World Map</h1>
        <div className="view-toggle">
          <button
            className={viewMode === 'map' ? 'active' : ''}
            onClick={() => setViewMode('map')}
          >
            Map View
          </button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
          >
            List View
          </button>
        </div>
      </header>

      <div className="world-stats">
        <div className="stat">
          <MapPin />
          <span>{cities.length} Cities</span>
        </div>
        <div className="stat">
          <Users />
          <span>{cities.reduce((sum, c) => sum + c.population, 0).toLocaleString()} Total Population</span>
        </div>
      </div>

      {loading ? (
        <div className="loading">Loading world map...</div>
      ) : viewMode === 'map' ? (
        <div className="map-container">
          <div className="map-canvas">
            {cities.map(city => {
              const left = ((city.x - minX) / mapWidth) * 100;
              const top = ((city.y - minY) / mapHeight) * 100;
              const isOwn = city.userId === user?.id;

              return (
                <div
                  key={city.id}
                  className={`city-marker ${isOwn ? 'own-city' : ''} ${city.isCapital ? 'capital' : ''}`}
                  style={{
                    left: `${left}%`,
                    top: `${top}%`
                  }}
                  onClick={() => goToCity(city.id, city.userId)}
                  title={`${city.name} (${city.owner.username})`}
                >
                  {city.isCapital ? <Crown size={16} /> : <MapPin size={16} />}
                  <span className="city-name">{city.name}</span>
                </div>
              );
            })}
          </div>
          <div className="map-legend">
            <div className="legend-item">
              <div className="legend-marker own-city"></div>
              <span>Your Cities</span>
            </div>
            <div className="legend-item">
              <div className="legend-marker"></div>
              <span>Other Cities</span>
            </div>
            <div className="legend-item">
              <Crown size={16} style={{ color: '#FFD700' }} />
              <span>Capitals</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="cities-list">
          <table>
            <thead>
              <tr>
                <th>City</th>
                <th>Owner</th>
                <th>Level</th>
                <th>Population</th>
                <th>Location</th>
              </tr>
            </thead>
            <tbody>
              {cities.map(city => (
                <tr
                  key={city.id}
                  className={city.userId === user?.id ? 'own-city-row' : ''}
                  onClick={() => goToCity(city.id, city.userId)}
                  style={{ cursor: city.userId === user?.id ? 'pointer' : 'default' }}
                >
                  <td>
                    {city.isCapital && <Crown size={14} style={{ color: '#FFD700', marginRight: '4px' }} />}
                    <strong>{city.name}</strong>
                  </td>
                  <td>{city.owner.username}</td>
                  <td>Level {city.owner.level}</td>
                  <td>{city.population.toLocaleString()}</td>
                  <td>({city.x}, {city.y})</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default WorldMap;
