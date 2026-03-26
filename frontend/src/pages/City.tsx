import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';
import { ArrowLeft, Users, Beaker } from 'lucide-react';
import CountdownTimer from '../components/CountdownTimer';
import { playSound } from '../utils/sounds';
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

interface TechInfo {
  name: string;
  cost: Record<string, number>;
  time: number;
  requires: string[];
  effects: Record<string, any>;
  category: string;
}

interface ResearchStatus {
  status: string;
  startedAt: string;
  completesAt: string;
}

const City: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [city, setCity] = useState<CityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [techTree, setTechTree] = useState<Record<string, TechInfo>>({});
  const [researches, setResearches] = useState<Record<string, ResearchStatus>>({});
  const [showResearch, setShowResearch] = useState(false);
  const [researchingTech, setResearchingTech] = useState<string | null>(null);

  useEffect(() => {
    fetchCity();
    fetchResearch();
    const interval = setInterval(updateProduction, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const fetchResearch = async () => {
    try {
      const response = await api.get(`/research/city/${id}`);
      setTechTree(response.data.techTree);
      setResearches(response.data.researches);
    } catch (error) {
      console.error('Failed to fetch research:', error);
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
      playSound('build');
    } catch (error: any) {
      playSound('error');
      alert(error.response?.data?.error || 'Failed to build');
    } finally {
      setBuilding(false);
    }
  };

  const startResearch = async (techId: string) => {
    setResearchingTech(techId);
    try {
      await api.post('/research/start', { cityId: id, techId });
      await fetchResearch();
      await fetchCity();
      playSound('research');
    } catch (error: any) {
      playSound('error');
      alert(error.response?.data?.error || 'Failed to start research');
    } finally {
      setResearchingTech(null);
    }
  };

  if (loading) return <div className="loading">Loading city...</div>;
  if (!city) return <div>City not found</div>;

  const BUILDING_INFO: Record<string, { icon: string; cost: string }> = {
    houses: { icon: 'Houses', cost: '50 Wood, 25 Stone, 10 Gold' },
    farms: { icon: 'Farms', cost: '100 Wood, 20 Gold' },
    sawmills: { icon: 'Sawmills', cost: '50 Stone, 30 Gold' },
    mines: { icon: 'Mines', cost: '75 Wood, 100 Stone, 50 Gold' },
    markets: { icon: 'Markets', cost: '100 Wood, 100 Stone, 100 Gold' },
    walls: { icon: 'Walls', cost: '200 Stone, 100 Iron, 75 Gold' },
    towers: { icon: 'Towers', cost: '150 Stone, 150 Iron, 100 Gold' },
  };

  return (
    <div className="city-page">
      <header className="city-header">
        <button onClick={() => navigate('/')} className="back-button">
          <ArrowLeft /> Back
        </button>
        <h1>{city.name}</h1>
        <div className="city-info">
          <span><Users size={16} /> {city.population.toLocaleString()}</span>
          <span>Happiness {city.happiness}%</span>
        </div>
      </header>

      <div className="city-layout">
        <section className="resources-panel">
          <h2>Resources</h2>
          <div className="resources-list">
            {['food', 'wood', 'stone', 'iron', 'gold', 'energy'].map(res => (
              <div className="resource-item" key={res}>
                <span className="resource-name">{res.charAt(0).toUpperCase() + res.slice(1)}</span>
                <span className="resource-amount">{Math.floor(city.resources[res] || 0)}</span>
                <span className="production">+{city.production[res] || 0}/h</span>
              </div>
            ))}
          </div>
        </section>

        <section className="buildings-panel">
          <h2>Buildings</h2>
          <div className="buildings-grid">
            <div className="building-card">
              <h3>Town Hall</h3>
              <p>Level {city.buildings.townHall || 1}</p>
            </div>
            {Object.entries(BUILDING_INFO).map(([key, info]) => (
              <div className="building-card" key={key}>
                <h3>{info.icon}</h3>
                <p>Count: {city.buildings[key] || 0}</p>
                <button onClick={() => buildStructure(key)} disabled={building}>
                  Build ({info.cost})
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Research Panel */}
        <section className="research-panel">
          <div className="section-header">
            <h2><Beaker size={18} /> Research</h2>
            <button className="btn-toggle" onClick={() => setShowResearch(!showResearch)}>
              {showResearch ? 'Hide' : 'Show'} Tech Tree
            </button>
          </div>

          {/* Currently researching */}
          {Object.entries(researches).filter(([, r]) => r.status === 'researching').map(([techId, r]) => (
            <div key={techId} className="research-progress">
              <span>Researching <strong>{techTree[techId]?.name}</strong></span>
              <CountdownTimer
                targetDate={r.completesAt}
                startDate={r.startedAt}
                showProgress={true}
                onComplete={() => { fetchResearch(); playSound('achievement'); }}
              />
            </div>
          ))}

          {showResearch && (
            <div className="tech-tree-grid">
              {Object.entries(techTree).map(([techId, tech]) => {
                const status = researches[techId];
                const isCompleted = status?.status === 'completed';
                const isResearching = status?.status === 'researching';
                const hasPrereqs = tech.requires.every(r => researches[r]?.status === 'completed');
                const isAnyResearching = Object.values(researches).some(r => r.status === 'researching');

                return (
                  <div
                    key={techId}
                    className={`tech-card ${isCompleted ? 'completed' : ''} ${isResearching ? 'researching' : ''} ${!hasPrereqs ? 'locked' : ''}`}
                  >
                    <div className="tech-header">
                      <h4>{tech.name}</h4>
                      <span className={`tech-category cat-${tech.category}`}>{tech.category}</span>
                    </div>
                    <div className="tech-cost">
                      {Object.entries(tech.cost).map(([res, amt]) => (
                        <span key={res}>{amt} {res}</span>
                      ))}
                    </div>
                    <div className="tech-time">{Math.round(tech.time / 60)}min</div>
                    {tech.requires.length > 0 && (
                      <div className="tech-requires">
                        Requires: {tech.requires.map(r => techTree[r]?.name).join(', ')}
                      </div>
                    )}
                    {isCompleted ? (
                      <div className="tech-status-done">Completed</div>
                    ) : isResearching ? (
                      <CountdownTimer targetDate={status.completesAt} startDate={status.startedAt} showProgress />
                    ) : (
                      <button
                        onClick={() => startResearch(techId)}
                        disabled={!hasPrereqs || isAnyResearching || researchingTech === techId}
                      >
                        {!hasPrereqs ? 'Locked' : isAnyResearching ? 'Busy' : 'Research'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="city-map">
          <h2>City View</h2>
          <div className="map-placeholder">
            <div className="city-grid">
              {Array.from({ length: 25 }).map((_, i) => (
                <div key={i} className="grid-tile">
                  {i === 12 && 'Town Hall'}
                  {[0, 4, 20, 24].includes(i) && (city.buildings.houses > 0 ? 'House' : '')}
                  {[6, 8, 16, 18].includes(i) && (city.buildings.farms > 0 ? 'Farm' : '')}
                  {[10, 14].includes(i) && (city.buildings.sawmills > 0 ? 'Mill' : '')}
                  {[1, 3, 21, 23].includes(i) && (city.buildings.walls > 0 ? 'Wall' : '')}
                  {[2, 22].includes(i) && (city.buildings.towers > 0 ? 'Tower' : '')}
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
