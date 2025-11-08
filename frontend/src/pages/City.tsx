import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';
import { ArrowLeft, Building, Users, Hammer, TrendingUp } from 'lucide-react';
import './City.css';

interface CityData {
  id: string;
  name: string;
  population: number;
  happiness: number;
  resources: Record<string, number>;
  buildings: Record<string, number>;
  production: Record<string, number>;
}

const City: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [city, setCity] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);

  useEffect(() => {
    fetchCity();
    const interval = setInterval(updateProduction, 30000);
    return () => clearInterval(interval);
  }, [id]);

  const fetchCity = async () => {
    try {
      const response = await api.get(`/cities/${id}`);
      setCity(response.data.city);
    } catch (error) {
      console.error('Failed to fetch city:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProduction = async () => {
    try {
      const response = await api.post(`/cities/${id}/update-production`);
      if (city) {
        setCity({
          ...city,
          resources: response.data.resources,
          population: response.data.population,
        });
      }
    } catch (error) {
      console.error('Failed to update production:', error);
    }
  };

  const buildStructure = async (buildingType: string) => {
    setBuilding(true);
    try {
      const response = await api.put(`/cities/${id}/build`, {
        building: buildingType,
        quantity: 1,
      });
      if (city) {
        setCity({
          ...city,
          resources: response.data.city.resources,
          buildings: response.data.city.buildings,
        });
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to build');
    } finally {
      setBuilding(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading city...</div>;
  }

  if (!city) {
    return <div>City not found</div>;
  }

  return (
    <div className="city-page">
      <header className="city-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1>{city.name}</h1>
        <div className="city-info">
          <span><Users /> {city.population.toLocaleString()}</span>
          <span>😊 {city.happiness}%</span>
        </div>
      </header>

      <div className="city-layout">
        <section className="resources-panel">
          <h2>Resources</h2>
          <div className="resources-list">
            <div className="resource-item">
              <span>🌾 Food</span>
              <span>{Math.floor(city.resources.food || 0)}</span>
              <span className="production">+{city.production.food || 0}/h</span>
            </div>
            <div className="resource-item">
              <span>🪵 Wood</span>
              <span>{Math.floor(city.resources.wood || 0)}</span>
              <span className="production">+{city.production.wood || 0}/h</span>
            </div>
            <div className="resource-item">
              <span>🪨 Stone</span>
              <span>{Math.floor(city.resources.stone || 0)}</span>
              <span className="production">+{city.production.stone || 0}/h</span>
            </div>
            <div className="resource-item">
              <span>⚙️ Iron</span>
              <span>{Math.floor(city.resources.iron || 0)}</span>
              <span className="production">+{city.production.iron || 0}/h</span>
            </div>
            <div className="resource-item">
              <span>🪙 Gold</span>
              <span>{Math.floor(city.resources.gold || 0)}</span>
              <span className="production">+{city.production.gold || 0}/h</span>
            </div>
            <div className="resource-item">
              <span>⚡ Energy</span>
              <span>{Math.floor(city.resources.energy || 0)}</span>
              <span className="production">+{city.production.energy || 0}/h</span>
            </div>
          </div>
        </section>

        <section className="buildings-panel">
          <h2>Buildings</h2>
          <div className="buildings-grid">
            <div className="building-card">
              <h3>🏛️ Town Hall</h3>
              <p>Level {city.buildings.townHall || 1}</p>
            </div>
            <div className="building-card">
              <h3>🏠 Houses</h3>
              <p>Count: {city.buildings.houses || 0}</p>
              <button onClick={() => buildStructure('houses')} disabled={building}>
                Build (50🪵 25🪨 10🪙)
              </button>
            </div>
            <div className="building-card">
              <h3>🌾 Farms</h3>
              <p>Count: {city.buildings.farms || 0}</p>
              <button onClick={() => buildStructure('farms')} disabled={building}>
                Build (100🪵 20🪙)
              </button>
            </div>
            <div className="building-card">
              <h3>🪵 Sawmills</h3>
              <p>Count: {city.buildings.sawmills || 0}</p>
              <button onClick={() => buildStructure('sawmills')} disabled={building}>
                Build (50🪨 30🪙)
              </button>
            </div>
            <div className="building-card">
              <h3>⛏️ Mines</h3>
              <p>Count: {city.buildings.mines || 0}</p>
              <button onClick={() => buildStructure('mines')} disabled={building}>
                Build (75🪵 100🪨 50🪙)
              </button>
            </div>
            <div className="building-card">
              <h3>🏪 Markets</h3>
              <p>Count: {city.buildings.markets || 0}</p>
              <button onClick={() => buildStructure('markets')} disabled={building}>
                Build (100🪵 100🪨 100🪙)
              </button>
            </div>
          </div>
        </section>

        <section className="city-map">
          <h2>City View</h2>
          <div className="map-placeholder">
            <div className="city-grid">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="grid-tile">
                  {i === 12 && '🏛️'}
                  {[0, 4, 20, 24].includes(i) && '🏠'}
                  {[6, 8, 16, 18].includes(i) && '🌾'}
                  {[10, 14].includes(i) && '🪵'}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default City;