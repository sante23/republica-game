import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/api';
import { ArrowLeft, Users, Beaker, Home, Wheat, TreePine, Mountain, Pickaxe, Store, Shield, Castle, FlaskConical } from 'lucide-react';
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

interface BuildingDef {
  name: string;
  icon: React.ReactNode;
  description: string;
  production: string;
  cost: string;
}

const RESOURCE_COLORS: Record<string, string> = {
  food: '#f6ad55',
  wood: '#68d391',
  stone: '#a0aec0',
  iron: '#fc8181',
  gold: '#fbd38d',
  energy: '#63b3ed',
};

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

  const BUILDINGS: Record<string, BuildingDef> = {
    houses: {
      name: 'Houses',
      icon: <Home size={20} />,
      description: 'Increase population capacity and energy production',
      production: '+500 max pop, +0.5 energy/h each',
      cost: '50 Wood, 25 Stone, 10 Gold',
    },
    farms: {
      name: 'Farms',
      icon: <Wheat size={20} />,
      description: 'Produce food for your population',
      production: '+5 food/h each',
      cost: '100 Wood, 20 Gold',
    },
    sawmills: {
      name: 'Sawmills',
      icon: <TreePine size={20} />,
      description: 'Process wood from nearby forests',
      production: '+3 wood/h each',
      cost: '50 Stone, 30 Gold',
    },
    mines: {
      name: 'Mines',
      icon: <Pickaxe size={20} />,
      description: 'Extract stone, iron and gold from the earth',
      production: '+2 stone/h, +1 iron/h, +0.5 gold/h each',
      cost: '75 Wood, 100 Stone, 50 Gold',
    },
    markets: {
      name: 'Markets',
      icon: <Store size={20} />,
      description: 'Generate gold through trade',
      production: '+3 gold/h each',
      cost: '100 Wood, 100 Stone, 100 Gold',
    },
    researchCenter: {
      name: 'Research Center',
      icon: <FlaskConical size={20} />,
      description: 'Required to research new technologies',
      production: 'Unlocks research capability',
      cost: '150 Wood, 200 Stone, 100 Iron, 200 Gold',
    },
    walls: {
      name: 'Walls',
      icon: <Shield size={20} />,
      description: 'Fortify your city against attacks',
      production: 'Defense bonus (requires Masonry)',
      cost: '200 Stone, 100 Iron, 75 Gold',
    },
    towers: {
      name: 'Towers',
      icon: <Castle size={20} />,
      description: 'Watch towers for advanced defense',
      production: 'Defense bonus (requires Fortification)',
      cost: '150 Stone, 150 Iron, 100 Gold',
    },
  };

  // Calculate current total production for display
  const getCurrentProduction = (key: string): string => {
    const count = city.buildings[key] || 0;
    if (count === 0) return 'None';
    switch (key) {
      case 'houses': return `+${(count * 0.5).toFixed(1)} energy/h, ${(count * 500).toLocaleString()} max pop`;
      case 'farms': return `+${count * 5} food/h`;
      case 'sawmills': return `+${count * 3} wood/h`;
      case 'mines': return `+${count * 2} stone/h, +${count} iron/h, +${(count * 0.5).toFixed(1)} gold/h`;
      case 'markets': return `+${count * 3} gold/h`;
      case 'researchCenter': return `${count} research slot(s)`;
      case 'walls': return `Defense: Level ${count}`;
      case 'towers': return `Defense: Level ${count}`;
      default: return '';
    }
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

      {/* Resource Bar */}
      <div className="city-resource-bar">
        {['food', 'wood', 'stone', 'iron', 'gold', 'energy'].map(res => (
          <div className="city-res-item" key={res}>
            <span className="city-res-dot" style={{ background: RESOURCE_COLORS[res] }} />
            <span className="city-res-name">{res.charAt(0).toUpperCase() + res.slice(1)}</span>
            <span className="city-res-amount">{Math.floor(city.resources[res] || 0).toLocaleString()}</span>
            <span className="city-res-prod">+{city.production[res] || 0}/h</span>
          </div>
        ))}
      </div>

      {/* Facilities - OGame style */}
      <section className="facilities-panel">
        <h2>Facilities</h2>
        <div className="facilities-list">
          {/* Town Hall - always first */}
          <div className="facility-row facility-townhall">
            <div className="facility-icon">
              <Mountain size={20} />
            </div>
            <div className="facility-info">
              <div className="facility-name-row">
                <h3>Town Hall</h3>
                <span className="facility-level">Level {city.buildings.townHall || 1}</span>
              </div>
              <p className="facility-desc">The heart of your city. Cannot be built manually.</p>
            </div>
          </div>

          {Object.entries(BUILDINGS).map(([key, def]) => {
            const count = city.buildings[key] || 0;
            const currentProd = getCurrentProduction(key);

            return (
              <div className={`facility-row ${count > 0 ? 'facility-active' : ''}`} key={key}>
                <div className="facility-icon" style={{ color: count > 0 ? '#667eea' : '#a0aec0' }}>
                  {def.icon}
                </div>
                <div className="facility-info">
                  <div className="facility-name-row">
                    <h3>{def.name}</h3>
                    <span className="facility-level">{count}</span>
                  </div>
                  <p className="facility-desc">{def.description}</p>
                  <div className="facility-details">
                    <span className="facility-per-unit">{def.production}</span>
                    {count > 0 && (
                      <span className="facility-current">Current: {currentProd}</span>
                    )}
                  </div>
                </div>
                <div className="facility-action">
                  <div className="facility-cost">{def.cost}</div>
                  <button
                    onClick={() => buildStructure(key)}
                    disabled={building}
                    className="facility-build-btn"
                  >
                    Build
                  </button>
                </div>
              </div>
            );
          })}
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

        {(!city.buildings.researchCenter || city.buildings.researchCenter < 1) && (
          <div className="research-warning">
            Build a Research Center to unlock technology research.
          </div>
        )}

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
              const hasResearchCenter = (city.buildings.researchCenter || 0) >= 1;

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
                      disabled={!hasPrereqs || isAnyResearching || researchingTech === techId || !hasResearchCenter}
                    >
                      {!hasResearchCenter ? 'No Lab' : !hasPrereqs ? 'Locked' : isAnyResearching ? 'Busy' : 'Research'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default City;
